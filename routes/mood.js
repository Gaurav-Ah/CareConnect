const express = require('express');
const { body, validationResult } = require('express-validator');
const { MoodEntry, User } = require('../models');
const { requireOwnershipOrRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const moment = require('moment');

const router = express.Router();

// Create mood entry
router.post('/', [
  body('mood_score').isInt({ min: 1, max: 10 }).withMessage('Mood score must be between 1 and 10'),
  body('mood_tags').isArray().optional(),
  body('notes').isLength({ max: 1000 }).optional(),
  body('activities').isArray().optional(),
  body('sleep_hours').isFloat({ min: 0, max: 24 }).optional(),
  body('exercise_minutes').isInt({ min: 0 }).optional(),
  body('social_interaction').isIn(['none', 'minimal', 'moderate', 'high']).optional(),
  body('stress_level').isInt({ min: 1, max: 10 }).optional(),
  body('energy_level').isInt({ min: 1, max: 10 }).optional(),
  body('entry_date').isDate().optional()
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
      mood_score,
      mood_tags,
      notes,
      activities,
      sleep_hours,
      exercise_minutes,
      social_interaction,
      stress_level,
      energy_level,
      entry_date
    } = req.body;

    // Check if entry already exists for this date
    const existingEntry = await MoodEntry.findOne({
      where: {
        user_id: req.user.id,
        entry_date: entry_date || moment().format('YYYY-MM-DD')
      }
    });

    if (existingEntry) {
      return res.status(409).json({ 
        message: 'Mood entry already exists for this date. Use PUT to update.' 
      });
    }

    const moodEntry = await MoodEntry.create({
      user_id: req.user.id,
      mood_score,
      mood_tags: mood_tags || [],
      notes,
      activities: activities || [],
      sleep_hours,
      exercise_minutes,
      social_interaction,
      stress_level,
      energy_level,
      entry_date: entry_date || moment().format('YYYY-MM-DD')
    });

    res.status(201).json({
      message: 'Mood entry created successfully',
      moodEntry
    });
  } catch (error) {
    console.error('Create mood entry error:', error);
    res.status(500).json({ message: 'Error creating mood entry' });
  }
});

// Get user's mood entries
router.get('/', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      page = 1, 
      limit = 30,
      user_id 
    } = req.query;

    // Determine which user's entries to fetch
    const targetUserId = user_id || req.user.id;

    // Check permissions for accessing other user's data
    if (targetUserId !== req.user.id && !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const offset = (page - 1) * limit;
    let whereClause = { user_id: targetUserId };

    // Date range filter
    if (start_date || end_date) {
      whereClause.entry_date = {};
      if (start_date) {
        whereClause.entry_date[Op.gte] = start_date;
      }
      if (end_date) {
        whereClause.entry_date[Op.lte] = end_date;
      }
    }

    const moodEntries = await MoodEntry.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['entry_date', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name']
      }]
    });

    res.json({
      moodEntries: moodEntries.rows,
      pagination: {
        total: moodEntries.count,
        page: parseInt(page),
        pages: Math.ceil(moodEntries.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get mood entries error:', error);
    res.status(500).json({ message: 'Error fetching mood entries' });
  }
});

// Get mood entry by ID
router.get('/:id', requireOwnershipOrRole('therapist', 'admin'), async (req, res) => {
  try {
    const moodEntry = await MoodEntry.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name']
      }]
    });

    if (!moodEntry) {
      return res.status(404).json({ message: 'Mood entry not found' });
    }

    res.json({ moodEntry });
  } catch (error) {
    console.error('Get mood entry error:', error);
    res.status(500).json({ message: 'Error fetching mood entry' });
  }
});

// Update mood entry
router.put('/:id', [
  body('mood_score').isInt({ min: 1, max: 10 }).optional(),
  body('mood_tags').isArray().optional(),
  body('notes').isLength({ max: 1000 }).optional(),
  body('activities').isArray().optional(),
  body('sleep_hours').isFloat({ min: 0, max: 24 }).optional(),
  body('exercise_minutes').isInt({ min: 0 }).optional(),
  body('social_interaction').isIn(['none', 'minimal', 'moderate', 'high']).optional(),
  body('stress_level').isInt({ min: 1, max: 10 }).optional(),
  body('energy_level').isInt({ min: 1, max: 10 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const moodEntry = await MoodEntry.findByPk(req.params.id);

    if (!moodEntry) {
      return res.status(404).json({ message: 'Mood entry not found' });
    }

    // Check ownership
    if (moodEntry.user_id !== req.user.id && !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const allowedUpdates = [
      'mood_score', 'mood_tags', 'notes', 'activities', 'sleep_hours',
      'exercise_minutes', 'social_interaction', 'stress_level', 'energy_level'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await moodEntry.update(updates);

    res.json({
      message: 'Mood entry updated successfully',
      moodEntry
    });
  } catch (error) {
    console.error('Update mood entry error:', error);
    res.status(500).json({ message: 'Error updating mood entry' });
  }
});

// Delete mood entry
router.delete('/:id', async (req, res) => {
  try {
    const moodEntry = await MoodEntry.findByPk(req.params.id);

    if (!moodEntry) {
      return res.status(404).json({ message: 'Mood entry not found' });
    }

    // Check ownership
    if (moodEntry.user_id !== req.user.id && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await moodEntry.destroy();

    res.json({ message: 'Mood entry deleted successfully' });
  } catch (error) {
    console.error('Delete mood entry error:', error);
    res.status(500).json({ message: 'Error deleting mood entry' });
  }
});

// Get mood analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const { 
      start_date = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      end_date = moment().format('YYYY-MM-DD'),
      user_id 
    } = req.query;

    const targetUserId = user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const moodEntries = await MoodEntry.findAll({
      where: {
        user_id: targetUserId,
        entry_date: {
          [Op.between]: [start_date, end_date]
        }
      },
      order: [['entry_date', 'ASC']]
    });

    if (moodEntries.length === 0) {
      return res.json({
        message: 'No mood data found for the specified period',
        analytics: null
      });
    }

    // Calculate analytics
    const moodScores = moodEntries.map(entry => entry.mood_score);
    const stressLevels = moodEntries.filter(entry => entry.stress_level).map(entry => entry.stress_level);
    const energyLevels = moodEntries.filter(entry => entry.energy_level).map(entry => entry.energy_level);
    const sleepHours = moodEntries.filter(entry => entry.sleep_hours).map(entry => entry.sleep_hours);

    const analytics = {
      period: { start_date, end_date },
      total_entries: moodEntries.length,
      mood: {
        average: (moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(2),
        highest: Math.max(...moodScores),
        lowest: Math.min(...moodScores),
        trend: calculateTrend(moodEntries.map(e => ({ date: e.entry_date, value: e.mood_score })))
      },
      stress: stressLevels.length > 0 ? {
        average: (stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length).toFixed(2),
        highest: Math.max(...stressLevels),
        lowest: Math.min(...stressLevels)
      } : null,
      energy: energyLevels.length > 0 ? {
        average: (energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length).toFixed(2),
        highest: Math.max(...energyLevels),
        lowest: Math.min(...energyLevels)
      } : null,
      sleep: sleepHours.length > 0 ? {
        average: (sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(1),
        total_hours: sleepHours.reduce((a, b) => a + b, 0).toFixed(1)
      } : null,
      most_common_tags: getMostCommonTags(moodEntries),
      most_common_activities: getMostCommonActivities(moodEntries)
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get mood analytics error:', error);
    res.status(500).json({ message: 'Error fetching mood analytics' });
  }
});

// Helper function to calculate trend
function calculateTrend(data) {
  if (data.length < 2) return 'insufficient_data';
  
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length;
  
  const difference = secondAvg - firstAvg;
  
  if (difference > 0.5) return 'improving';
  if (difference < -0.5) return 'declining';
  return 'stable';
}

// Helper function to get most common tags
function getMostCommonTags(entries) {
  const tagCounts = {};
  entries.forEach(entry => {
    entry.mood_tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
}

// Helper function to get most common activities
function getMostCommonActivities(entries) {
  const activityCounts = {};
  entries.forEach(entry => {
    entry.activities.forEach(activity => {
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
    });
  });
  
  return Object.entries(activityCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([activity, count]) => ({ activity, count }));
}

module.exports = router;