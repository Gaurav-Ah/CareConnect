const express = require('express');
const { body, validationResult } = require('express-validator');
const { Appointment, User } = require('../models');
const { requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { Op } = require('sequelize');
const moment = require('moment');

const router = express.Router();

// Create appointment (patients can request, therapists can create directly)
router.post('/', [
  body('therapist_id').isUUID().withMessage('Valid therapist ID required'),
  body('appointment_date').isISO8601().withMessage('Valid appointment date required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 180 }).withMessage('Duration must be between 15 and 180 minutes'),
  body('appointment_type').optional().isIn(['initial_consultation', 'follow_up', 'crisis_intervention', 'group_session', 'assessment']),
  body('session_format').optional().isIn(['in_person', 'video_call', 'phone_call']),
  body('notes').optional().isLength({ max: 1000 }),
  body('patient_notes').optional().isLength({ max: 1000 })
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
      therapist_id,
      appointment_date,
      duration_minutes = 60,
      appointment_type = 'follow_up',
      session_format = 'video_call',
      notes,
      patient_notes,
      location,
      meeting_link
    } = req.body;

    // Validate appointment is in the future
    if (moment(appointment_date).isBefore(moment())) {
      return res.status(400).json({ message: 'Appointment must be scheduled for a future date and time' });
    }

    // Validate therapist exists and has therapist role
    const therapist = await User.findByPk(therapist_id);
    if (!therapist || therapist.role !== 'therapist') {
      return res.status(404).json({ message: 'Therapist not found' });
    }

    // Check for scheduling conflicts
    const appointmentEnd = moment(appointment_date).add(duration_minutes, 'minutes');
    const conflictingAppointment = await Appointment.findOne({
      where: {
        therapist_id,
        status: ['scheduled', 'confirmed', 'in_progress'],
        [Op.or]: [
          {
            appointment_date: {
              [Op.between]: [appointment_date, appointmentEnd.toDate()]
            }
          },
          {
            [Op.and]: [
              { appointment_date: { [Op.lte]: appointment_date } },
              {
                [Op.literal]: `appointment_date + INTERVAL duration_minutes MINUTE > '${moment(appointment_date).format('YYYY-MM-DD HH:mm:ss')}'`
              }
            ]
          }
        ]
      }
    });

    if (conflictingAppointment) {
      return res.status(409).json({ 
        message: 'Therapist is not available at this time',
        conflicting_appointment: conflictingAppointment.id
      });
    }

    // Determine patient ID based on user role
    let patient_id;
    let status = 'scheduled';

    if (req.user.role === 'patient') {
      patient_id = req.user.id;
      // Patients create appointment requests that need therapist confirmation
      status = 'scheduled';
    } else if (req.user.role === 'therapist' && req.user.id === therapist_id) {
      // Therapists can create appointments directly
      patient_id = req.body.patient_id;
      if (!patient_id) {
        return res.status(400).json({ message: 'Patient ID required when therapist creates appointment' });
      }
      status = 'confirmed';
    } else if (req.user.role === 'admin') {
      // Admins can create appointments for any patient-therapist pair
      patient_id = req.body.patient_id;
      if (!patient_id) {
        return res.status(400).json({ message: 'Patient ID required' });
      }
      status = 'confirmed';
    } else {
      return res.status(403).json({ message: 'Only patients, therapists, and admins can create appointments' });
    }

    // Validate patient exists
    const patient = await User.findByPk(patient_id);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const appointment = await Appointment.create({
      patient_id,
      therapist_id,
      appointment_date,
      duration_minutes,
      appointment_type,
      session_format,
      status,
      notes,
      patient_notes,
      location,
      meeting_link
    });

    res.status(201).json({
      message: 'Appointment created successfully',
      appointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Error creating appointment' });
  }
});

// Get appointments with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      start_date,
      end_date,
      therapist_id,
      patient_id,
      appointment_type,
      session_format
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = {};

    // Role-based filtering
    if (req.user.role === 'patient') {
      whereClause.patient_id = req.user.id;
    } else if (req.user.role === 'therapist') {
      whereClause.therapist_id = req.user.id;
    }
    // Admins can see all appointments

    // Additional filters
    if (status) {
      whereClause.status = status;
    }

    if (therapist_id && req.user.role !== 'therapist') {
      whereClause.therapist_id = therapist_id;
    }

    if (patient_id && req.user.role !== 'patient') {
      whereClause.patient_id = patient_id;
    }

    if (appointment_type) {
      whereClause.appointment_type = appointment_type;
    }

    if (session_format) {
      whereClause.session_format = session_format;
    }

    // Date range filter
    if (start_date || end_date) {
      whereClause.appointment_date = {};
      if (start_date) {
        whereClause.appointment_date[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.appointment_date[Op.lte] = new Date(end_date);
      }
    }

    const appointments = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        },
        {
          model: User,
          as: 'therapist',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['appointment_date', 'ASC']]
    });

    res.json({
      appointments: appointments.rows,
      pagination: {
        total: appointments.count,
        page: parseInt(page),
        pages: Math.ceil(appointments.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

// Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth']
        },
        {
          model: User,
          as: 'therapist',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check permissions
    const hasAccess = req.user.role === 'admin' || 
                     appointment.patient_id === req.user.id || 
                     appointment.therapist_id === req.user.id;

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ message: 'Error fetching appointment' });
  }
});

// Update appointment
router.put('/:id', [
  body('appointment_date').optional().isISO8601(),
  body('duration_minutes').optional().isInt({ min: 15, max: 180 }),
  body('appointment_type').optional().isIn(['initial_consultation', 'follow_up', 'crisis_intervention', 'group_session', 'assessment']),
  body('session_format').optional().isIn(['in_person', 'video_call', 'phone_call']),
  body('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  body('notes').optional().isLength({ max: 1000 }),
  body('patient_notes').optional().isLength({ max: 1000 }),
  body('therapist_notes').optional().isLength({ max: 2000 }),
  body('session_summary').optional().isLength({ max: 2000 }),
  body('homework_assigned').optional().isLength({ max: 1000 }),
  body('next_session_goals').optional().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check permissions
    const canUpdate = req.user.role === 'admin' || 
                     appointment.patient_id === req.user.id || 
                     appointment.therapist_id === req.user.id;

    if (!canUpdate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Define what each role can update
    let allowedUpdates = [];
    
    if (req.user.role === 'admin') {
      allowedUpdates = [
        'appointment_date', 'duration_minutes', 'appointment_type', 'session_format',
        'status', 'notes', 'patient_notes', 'therapist_notes', 'session_summary',
        'homework_assigned', 'next_session_goals', 'location', 'meeting_link',
        'cancellation_reason', 'follow_up_required'
      ];
    } else if (appointment.therapist_id === req.user.id) {
      allowedUpdates = [
        'appointment_date', 'duration_minutes', 'appointment_type', 'session_format',
        'status', 'therapist_notes', 'session_summary', 'homework_assigned',
        'next_session_goals', 'location', 'meeting_link', 'follow_up_required'
      ];
    } else if (appointment.patient_id === req.user.id) {
      // Patients can only update certain fields and only before the appointment
      if (moment(appointment.appointment_date).isAfter(moment())) {
        allowedUpdates = ['patient_notes', 'cancellation_reason'];
        if (req.body.status === 'cancelled') {
          allowedUpdates.push('status');
        }
      } else {
        return res.status(400).json({ message: 'Cannot update past appointments' });
      }
    }

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Special handling for cancellation
    if (updates.status === 'cancelled') {
      updates.cancelled_by = req.user.id;
    }

    // Validate future date if updating appointment_date
    if (updates.appointment_date && moment(updates.appointment_date).isBefore(moment())) {
      return res.status(400).json({ message: 'Appointment must be scheduled for a future date and time' });
    }

    await appointment.update(updates);

    res.json({
      message: 'Appointment updated successfully',
      appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ message: 'Error updating appointment' });
  }
});

// Cancel appointment
router.put('/:id/cancel', [
  body('cancellation_reason').notEmpty().withMessage('Cancellation reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { cancellation_reason } = req.body;
    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check permissions
    const canCancel = req.user.role === 'admin' || 
                     appointment.patient_id === req.user.id || 
                     appointment.therapist_id === req.user.id;

    if (!canCancel) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel completed appointments' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ message: 'Appointment is already cancelled' });
    }

    await appointment.update({
      status: 'cancelled',
      cancellation_reason,
      cancelled_by: req.user.id
    });

    res.json({
      message: 'Appointment cancelled successfully',
      appointment
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ message: 'Error cancelling appointment' });
  }
});

// Get therapist availability
router.get('/therapist/:therapistId/availability', async (req, res) => {
  try {
    const { date, duration = 60 } = req.query;
    const therapistId = req.params.therapistId;

    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    // Validate therapist exists
    const therapist = await User.findByPk(therapistId);
    if (!therapist || therapist.role !== 'therapist') {
      return res.status(404).json({ message: 'Therapist not found' });
    }

    const startOfDay = moment(date).startOf('day');
    const endOfDay = moment(date).endOf('day');

    // Get all appointments for the therapist on this date
    const appointments = await Appointment.findAll({
      where: {
        therapist_id: therapistId,
        appointment_date: {
          [Op.between]: [startOfDay.toDate(), endOfDay.toDate()]
        },
        status: ['scheduled', 'confirmed', 'in_progress']
      },
      order: [['appointment_date', 'ASC']]
    });

    // Define working hours (9 AM to 6 PM)
    const workingHours = {
      start: 9,
      end: 18
    };

    const availableSlots = [];
    const slotDuration = parseInt(duration);

    // Generate time slots
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
        const slotStart = moment(date).hour(hour).minute(minute).second(0);
        const slotEnd = slotStart.clone().add(slotDuration, 'minutes');

        // Check if slot is in the past
        if (slotStart.isBefore(moment())) {
          continue;
        }

        // Check if slot would extend beyond working hours
        if (slotEnd.hour() > workingHours.end) {
          continue;
        }

        // Check for conflicts with existing appointments
        const hasConflict = appointments.some(appointment => {
          const appointmentStart = moment(appointment.appointment_date);
          const appointmentEnd = appointmentStart.clone().add(appointment.duration_minutes, 'minutes');

          return slotStart.isBefore(appointmentEnd) && slotEnd.isAfter(appointmentStart);
        });

        if (!hasConflict) {
          availableSlots.push({
            start_time: slotStart.format('YYYY-MM-DD HH:mm:ss'),
            end_time: slotEnd.format('YYYY-MM-DD HH:mm:ss'),
            duration_minutes: slotDuration
          });
        }
      }
    }

    res.json({
      therapist_id: therapistId,
      date,
      available_slots: availableSlots,
      total_slots: availableSlots.length
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ message: 'Error fetching availability' });
  }
});

// Get appointment statistics
router.get('/stats/summary', requireRole('therapist', 'admin'), async (req, res) => {
  try {
    const {
      start_date = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      end_date = moment().format('YYYY-MM-DD'),
      therapist_id
    } = req.query;

    let whereClause = {
      appointment_date: {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      }
    };

    // Filter by therapist if specified or if user is a therapist
    if (therapist_id) {
      whereClause.therapist_id = therapist_id;
    } else if (req.user.role === 'therapist') {
      whereClause.therapist_id = req.user.id;
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id']
        },
        {
          model: User,
          as: 'therapist',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    const stats = {
      period: { start_date, end_date },
      total_appointments: appointments.length,
      by_status: {},
      by_type: {},
      by_format: {},
      unique_patients: new Set(appointments.map(apt => apt.patient_id)).size,
      total_duration_hours: appointments.reduce((sum, apt) => sum + apt.duration_minutes, 0) / 60,
      cancellation_rate: 0,
      no_show_rate: 0,
      completion_rate: 0
    };

    // Calculate statistics
    appointments.forEach(appointment => {
      // By status
      stats.by_status[appointment.status] = (stats.by_status[appointment.status] || 0) + 1;
      
      // By type
      stats.by_type[appointment.appointment_type] = (stats.by_type[appointment.appointment_type] || 0) + 1;
      
      // By format
      stats.by_format[appointment.session_format] = (stats.by_format[appointment.session_format] || 0) + 1;
    });

    // Calculate rates
    if (stats.total_appointments > 0) {
      stats.cancellation_rate = ((stats.by_status.cancelled || 0) / stats.total_appointments * 100).toFixed(2);
      stats.no_show_rate = ((stats.by_status.no_show || 0) / stats.total_appointments * 100).toFixed(2);
      stats.completion_rate = ((stats.by_status.completed || 0) / stats.total_appointments * 100).toFixed(2);
    }

    res.json({ stats });
  } catch (error) {
    console.error('Get appointment stats error:', error);
    res.status(500).json({ message: 'Error fetching appointment statistics' });
  }
});

module.exports = router;