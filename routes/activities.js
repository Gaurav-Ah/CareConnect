const express = require('express');
const { body, validationResult } = require('express-validator');
const { Activity, ActivityParticipant, User } = require('../models');
const { requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const moment = require('moment');

const router = express.Router();

// Create new activity
router.post('/', requireRole('volunteer', 'therapist', 'admin'), [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().isLength({ max: 2000 }),
  body('activity_type').isIn(['dance', 'music', 'art', 'meditation', 'group_therapy', 'workshop', 'social', 'exercise']),
  body('scheduled_date').isISO8601().withMessage('Valid date required'),
  body('duration_minutes').isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('max_participants').optional().isInt({ min: 1 }),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced', 'all_levels']),
  body('is_virtual').optional().isBoolean(),
  body('location').optional().isString(),
  body('meeting_link').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const {
      title,
      description,
      activity_type,
      scheduled_date,
      duration_minutes,
      max_participants,
      difficulty_level = 'all_levels',
      is_virtual = false,
      location,
      meeting_link,
      materials_needed,
      tags,
      is_recurring = false,
      recurrence_pattern,
      age_restriction,
      special_requirements
    } = req.body;

    // Validate that scheduled date is in the future
    if (moment(scheduled_date).isBefore(moment())) {
      return res.status(400).json({ message: 'Activity must be scheduled for a future date' });
    }

    // Validate virtual meeting requirements
    if (is_virtual && !meeting_link) {
      return res.status(400).json({ message: 'Meeting link is required for virtual activities' });
    }

    const activity = await Activity.create({
      title,
      description,
      activity_type,
      scheduled_date,
      duration_minutes,
      max_participants,
      difficulty_level,
      created_by: req.user.id,
      is_virtual,
      location,
      meeting_link,
      materials_needed: materials_needed || [],
      tags: tags || [],
      is_recurring,
      recurrence_pattern,
      age_restriction,
      special_requirements
    });

    // Auto-register the creator as a participant
    await ActivityParticipant.create({
      user_id: req.user.id,
      activity_id: activity.id,
      registration_status: 'registered'
    });

    res.status(201).json({
      message: 'Activity created successfully',
      activity
    });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ message: 'Error creating activity' });
  }
});

// Get activities with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      activity_type,
      difficulty_level,
      is_virtual,
      start_date,
      end_date,
      search,
      tags,
      status = 'scheduled',
      my_activities = false
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = {};

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter by activity type
    if (activity_type) {
      whereClause.activity_type = activity_type;
    }

    // Filter by difficulty level
    if (difficulty_level) {
      whereClause.difficulty_level = difficulty_level;
    }

    // Filter by virtual/in-person
    if (is_virtual !== undefined) {
      whereClause.is_virtual = is_virtual === 'true';
    }

    // Date range filter
    if (start_date || end_date) {
      whereClause.scheduled_date = {};
      if (start_date) {
        whereClause.scheduled_date[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.scheduled_date[Op.lte] = new Date(end_date);
      }
    } else {
      // Default to future activities only
      whereClause.scheduled_date = {
        [Op.gte]: new Date()
      };
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      whereClause.tags = {
        [Op.overlap]: tagArray
      };
    }

    // Filter by user's activities
    if (my_activities === 'true') {
      whereClause.created_by = req.user.id;
    }

    const activities = await Activity.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'role']
        },
        {
          model: User,
          as: 'participants',
          through: {
            attributes: ['registration_status', 'registration_date'],
            where: { registration_status: ['registered', 'attended'] }
          },
          attributes: ['id', 'first_name', 'last_name', 'profile_picture'],
          required: false
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['scheduled_date', 'ASC']]
    });

    // Add participant count and user registration status to each activity
    const activitiesWithDetails = await Promise.all(
      activities.rows.map(async (activity) => {
        const participantCount = await ActivityParticipant.count({
          where: {
            activity_id: activity.id,
            registration_status: ['registered', 'attended']
          }
        });

        const userRegistration = await ActivityParticipant.findOne({
          where: {
            activity_id: activity.id,
            user_id: req.user.id
          }
        });

        return {
          ...activity.toJSON(),
          participant_count: participantCount,
          user_registration_status: userRegistration?.registration_status || null,
          is_full: activity.max_participants ? participantCount >= activity.max_participants : false
        };
      })
    );

    res.json({
      activities: activitiesWithDetails,
      pagination: {
        total: activities.count,
        page: parseInt(page),
        pages: Math.ceil(activities.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Error fetching activities' });
  }
});

// Get activity by ID
router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture']
        },
        {
          model: User,
          as: 'participants',
          through: {
            attributes: ['registration_status', 'registration_date', 'special_needs']
          },
          attributes: ['id', 'first_name', 'last_name', 'profile_picture', 'role']
        }
      ]
    });

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Get user's registration status
    const userRegistration = await ActivityParticipant.findOne({
      where: {
        activity_id: activity.id,
        user_id: req.user.id
      }
    });

    const participantCount = await ActivityParticipant.count({
      where: {
        activity_id: activity.id,
        registration_status: ['registered', 'attended']
      }
    });

    res.json({
      activity: {
        ...activity.toJSON(),
        participant_count: participantCount,
        user_registration_status: userRegistration?.registration_status || null,
        is_full: activity.max_participants ? participantCount >= activity.max_participants : false
      }
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ message: 'Error fetching activity' });
  }
});

// Update activity
router.put('/:id', [
  body('title').optional().isLength({ max: 200 }),
  body('description').optional().isLength({ max: 2000 }),
  body('scheduled_date').optional().isISO8601(),
  body('duration_minutes').optional().isInt({ min: 15, max: 480 }),
  body('max_participants').optional().isInt({ min: 1 }),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced', 'all_levels']),
  body('is_virtual').optional().isBoolean(),
  body('location').optional().isString(),
  body('meeting_link').optional().isURL(),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const activity = await Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Check permissions - only creator or admin can update
    if (activity.created_by !== req.user.id && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only update activities you created' });
    }

    const allowedUpdates = [
      'title', 'description', 'scheduled_date', 'duration_minutes', 'max_participants',
      'difficulty_level', 'is_virtual', 'location', 'meeting_link', 'materials_needed',
      'tags', 'age_restriction', 'special_requirements', 'status'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate future date if updating scheduled_date
    if (updates.scheduled_date && moment(updates.scheduled_date).isBefore(moment())) {
      return res.status(400).json({ message: 'Activity must be scheduled for a future date' });
    }

    await activity.update(updates);

    res.json({
      message: 'Activity updated successfully',
      activity
    });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ message: 'Error updating activity' });
  }
});

// Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Check permissions - only creator or admin can delete
    if (activity.created_by !== req.user.id && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only delete activities you created' });
    }

    // Check if activity has started
    if (moment(activity.scheduled_date).isBefore(moment()) && activity.status !== 'cancelled') {
      return res.status(400).json({ message: 'Cannot delete an activity that has already started' });
    }

    await activity.destroy();

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ message: 'Error deleting activity' });
  }
});

// Register for activity
router.post('/:id/register', [
  body('special_needs').optional().isString()
], async (req, res) => {
  try {
    const { special_needs } = req.body;
    const activity = await Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Check if activity is in the future
    if (moment(activity.scheduled_date).isBefore(moment())) {
      return res.status(400).json({ message: 'Cannot register for past activities' });
    }

    // Check if activity is cancelled
    if (activity.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot register for cancelled activities' });
    }

    // Check if user is already registered
    const existingRegistration = await ActivityParticipant.findOne({
      where: {
        user_id: req.user.id,
        activity_id: activity.id
      }
    });

    if (existingRegistration) {
      return res.status(409).json({ 
        message: 'You are already registered for this activity',
        status: existingRegistration.registration_status
      });
    }

    // Check if activity is full
    const participantCount = await ActivityParticipant.count({
      where: {
        activity_id: activity.id,
        registration_status: ['registered', 'attended']
      }
    });

    const registrationStatus = (activity.max_participants && participantCount >= activity.max_participants) 
      ? 'waitlisted' 
      : 'registered';

    const registration = await ActivityParticipant.create({
      user_id: req.user.id,
      activity_id: activity.id,
      registration_status: registrationStatus,
      special_needs
    });

    res.status(201).json({
      message: registrationStatus === 'waitlisted' 
        ? 'Added to waitlist successfully' 
        : 'Registered successfully',
      registration
    });
  } catch (error) {
    console.error('Register for activity error:', error);
    res.status(500).json({ message: 'Error registering for activity' });
  }
});

// Unregister from activity
router.delete('/:id/register', async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    const registration = await ActivityParticipant.findOne({
      where: {
        user_id: req.user.id,
        activity_id: activity.id
      }
    });

    if (!registration) {
      return res.status(404).json({ message: 'You are not registered for this activity' });
    }

    // Check if activity has already started
    if (moment(activity.scheduled_date).isBefore(moment()) && activity.status !== 'scheduled') {
      return res.status(400).json({ message: 'Cannot unregister from an activity that has already started' });
    }

    await registration.destroy();

    // If someone was on the waitlist, move them to registered
    if (activity.max_participants) {
      const waitlistedUser = await ActivityParticipant.findOne({
        where: {
          activity_id: activity.id,
          registration_status: 'waitlisted'
        },
        order: [['registration_date', 'ASC']]
      });

      if (waitlistedUser) {
        await waitlistedUser.update({ registration_status: 'registered' });
      }
    }

    res.json({ message: 'Unregistered successfully' });
  } catch (error) {
    console.error('Unregister from activity error:', error);
    res.status(500).json({ message: 'Error unregistering from activity' });
  }
});

// Get user's registered activities
router.get('/user/registrations', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = { user_id: req.user.id };
    
    if (status) {
      whereClause.registration_status = status;
    }

    const registrations = await ActivityParticipant.findAndCountAll({
      where: whereClause,
      include: [{
        model: Activity,
        include: [{
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'role']
        }]
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['registration_date', 'DESC']]
    });

    res.json({
      registrations: registrations.rows,
      pagination: {
        total: registrations.count,
        page: parseInt(page),
        pages: Math.ceil(registrations.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get user registrations error:', error);
    res.status(500).json({ message: 'Error fetching user registrations' });
  }
});

// Submit activity feedback
router.post('/:id/feedback', requireOwnershipOrRole('admin'), [
  body('feedback_rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback_comment').optional().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { feedback_rating, feedback_comment } = req.body;

    const registration = await ActivityParticipant.findOne({
      where: {
        user_id: req.user.id,
        activity_id: req.params.id,
        registration_status: 'attended'
      }
    });

    if (!registration) {
      return res.status(404).json({ 
        message: 'You must have attended this activity to leave feedback' 
      });
    }

    await registration.update({
      feedback_rating,
      feedback_comment
    });

    res.json({
      message: 'Feedback submitted successfully',
      registration
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ message: 'Error submitting feedback' });
  }
});

module.exports = router;