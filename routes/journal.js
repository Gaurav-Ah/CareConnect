const express = require('express');
const { body, validationResult } = require('express-validator');
const { JournalEntry, User } = require('../models');
const { requireOwnershipOrRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const moment = require('moment');

const router = express.Router();

// Create journal entry
router.post('/', [
  body('title').optional().isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('content').notEmpty().withMessage('Content is required').isLength({ max: 10000 }).withMessage('Content must be less than 10000 characters'),
  body('mood_before').optional().isInt({ min: 1, max: 10 }).withMessage('Mood before must be between 1 and 10'),
  body('mood_after').optional().isInt({ min: 1, max: 10 }).withMessage('Mood after must be between 1 and 10'),
  body('tags').optional().isArray(),
  body('is_private').optional().isBoolean(),
  body('prompt_used').optional().isString()
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
      content,
      mood_before,
      mood_after,
      tags,
      is_private = true,
      prompt_used
    } = req.body;

    const journalEntry = await JournalEntry.create({
      user_id: req.user.id,
      title,
      content,
      mood_before,
      mood_after,
      tags: tags || [],
      is_private,
      prompt_used
    });

    res.status(201).json({
      message: 'Journal entry created successfully',
      journalEntry
    });
  } catch (error) {
    console.error('Create journal entry error:', error);
    res.status(500).json({ message: 'Error creating journal entry' });
  }
});

// Get user's journal entries
router.get('/', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      page = 1, 
      limit = 20,
      user_id,
      tags,
      search,
      include_private = 'true'
    } = req.query;

    // Determine which user's entries to fetch
    const targetUserId = user_id || req.user.id;

    // Check permissions for accessing other user's data
    if (targetUserId !== req.user.id && !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const offset = (page - 1) * limit;
    let whereClause = { user_id: targetUserId };

    // Privacy filter - only show private entries to owner or therapist/admin
    if (targetUserId !== req.user.id || include_private === 'false') {
      whereClause.is_private = false;
    }

    // Date range filter
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) {
        whereClause.created_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.created_at[Op.lte] = new Date(end_date);
      }
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      whereClause.tags = {
        [Op.overlap]: tagArray
      };
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const journalEntries = await JournalEntry.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name']
      }]
    });

    res.json({
      journalEntries: journalEntries.rows,
      pagination: {
        total: journalEntries.count,
        page: parseInt(page),
        pages: Math.ceil(journalEntries.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get journal entries error:', error);
    res.status(500).json({ message: 'Error fetching journal entries' });
  }
});

// Get journal entry by ID
router.get('/:id', async (req, res) => {
  try {
    const journalEntry = await JournalEntry.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name']
      }]
    });

    if (!journalEntry) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Check permissions - only owner, therapist, or admin can view
    // Private entries can only be viewed by owner or therapist/admin
    if (journalEntry.user_id !== req.user.id && !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (journalEntry.is_private && 
        journalEntry.user_id !== req.user.id && 
        !['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'This journal entry is private' });
    }

    res.json({ journalEntry });
  } catch (error) {
    console.error('Get journal entry error:', error);
    res.status(500).json({ message: 'Error fetching journal entry' });
  }
});

// Update journal entry
router.put('/:id', [
  body('title').optional().isLength({ max: 200 }),
  body('content').optional().isLength({ max: 10000 }),
  body('mood_before').optional().isInt({ min: 1, max: 10 }),
  body('mood_after').optional().isInt({ min: 1, max: 10 }),
  body('tags').optional().isArray(),
  body('is_private').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const journalEntry = await JournalEntry.findByPk(req.params.id);

    if (!journalEntry) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Check ownership - only owner can update
    if (journalEntry.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own journal entries' });
    }

    const allowedUpdates = [
      'title', 'content', 'mood_before', 'mood_after', 'tags', 'is_private'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await journalEntry.update(updates);

    res.json({
      message: 'Journal entry updated successfully',
      journalEntry
    });
  } catch (error) {
    console.error('Update journal entry error:', error);
    res.status(500).json({ message: 'Error updating journal entry' });
  }
});

// Delete journal entry
router.delete('/:id', async (req, res) => {
  try {
    const journalEntry = await JournalEntry.findByPk(req.params.id);

    if (!journalEntry) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Check ownership - only owner or admin can delete
    if (journalEntry.user_id !== req.user.id && !['admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await journalEntry.destroy();

    res.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Delete journal entry error:', error);
    res.status(500).json({ message: 'Error deleting journal entry' });
  }
});

// Get journal analytics
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

    const journalEntries = await JournalEntry.findAll({
      where: {
        user_id: targetUserId,
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        }
      },
      order: [['created_at', 'ASC']]
    });

    if (journalEntries.length === 0) {
      return res.json({
        message: 'No journal data found for the specified period',
        analytics: null
      });
    }

    // Calculate analytics
    const totalEntries = journalEntries.length;
    const totalWords = journalEntries.reduce((sum, entry) => sum + (entry.word_count || 0), 0);
    const entriesWithMoodBefore = journalEntries.filter(entry => entry.mood_before);
    const entriesWithMoodAfter = journalEntries.filter(entry => entry.mood_after);
    
    // Mood improvement calculation
    const moodImprovements = journalEntries
      .filter(entry => entry.mood_before && entry.mood_after)
      .map(entry => entry.mood_after - entry.mood_before);

    // Most common tags
    const tagCounts = {};
    journalEntries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Writing frequency by day of week
    const dayOfWeekCounts = {};
    journalEntries.forEach(entry => {
      const dayOfWeek = moment(entry.created_at).format('dddd');
      dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
    });

    const analytics = {
      period: { start_date, end_date },
      writing_stats: {
        total_entries: totalEntries,
        total_words: totalWords,
        average_words_per_entry: totalWords > 0 ? Math.round(totalWords / totalEntries) : 0,
        average_entries_per_week: Math.round((totalEntries / moment(end_date).diff(moment(start_date), 'weeks')) * 10) / 10
      },
      mood_tracking: {
        entries_with_mood_before: entriesWithMoodBefore.length,
        entries_with_mood_after: entriesWithMoodAfter.length,
        average_mood_before: entriesWithMoodBefore.length > 0 ? 
          (entriesWithMoodBefore.reduce((sum, entry) => sum + entry.mood_before, 0) / entriesWithMoodBefore.length).toFixed(2) : null,
        average_mood_after: entriesWithMoodAfter.length > 0 ? 
          (entriesWithMoodAfter.reduce((sum, entry) => sum + entry.mood_after, 0) / entriesWithMoodAfter.length).toFixed(2) : null,
        mood_improvements: moodImprovements.length > 0 ? {
          total_sessions: moodImprovements.length,
          average_improvement: (moodImprovements.reduce((sum, improvement) => sum + improvement, 0) / moodImprovements.length).toFixed(2),
          positive_sessions: moodImprovements.filter(improvement => improvement > 0).length,
          negative_sessions: moodImprovements.filter(improvement => improvement < 0).length,
          neutral_sessions: moodImprovements.filter(improvement => improvement === 0).length
        } : null
      },
      most_common_tags: Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
      writing_patterns: {
        by_day_of_week: Object.entries(dayOfWeekCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([day, count]) => ({ day, count })),
        most_productive_day: Object.entries(dayOfWeekCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || null
      }
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get journal analytics error:', error);
    res.status(500).json({ message: 'Error fetching journal analytics' });
  }
});

// Get journal prompts
router.get('/prompts/random', (req, res) => {
  const prompts = [
    "What are three things you're grateful for today?",
    "Describe a moment today when you felt proud of yourself.",
    "What challenge did you face today and how did you handle it?",
    "Write about someone who made you smile today.",
    "What did you learn about yourself today?",
    "Describe your ideal day. What would it look like?",
    "What's one thing you'd like to improve about tomorrow?",
    "Write about a memory that always makes you feel better.",
    "What are your current goals and how are you working toward them?",
    "Describe how you're feeling right now without using emotion words.",
    "What's something new you'd like to try this week?",
    "Write about a place where you feel most at peace.",
    "What advice would you give to someone going through what you're experiencing?",
    "Describe a recent act of kindness you witnessed or experienced.",
    "What are you most looking forward to right now?",
    "Write about a strength you have that you sometimes forget about.",
    "What's one thing you wish people knew about you?",
    "Describe a time when you overcame something difficult.",
    "What does self-care mean to you?",
    "Write about your hopes for the future."
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  res.json({ 
    prompt: randomPrompt,
    total_prompts: prompts.length 
  });
});

module.exports = router;