const registrationsService = require('./registrations.service');

const registerAttendee = async (req, res, next) => {
  try {
    const { id: workshopId } = req.params;
    const { attendeeName, attendeeEmail } = req.body;
    const result = await registrationsService.registerAttendee(
      workshopId,
      { attendeeName, attendeeEmail },
      req.user.id
    );
    res.status(201).json({
      success: true,
      message: 'Attendee registered successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const cancelRegistration = async (req, res, next) => {
  try {
    const { id: registrationId } = req.params;
    const { cancellationReason } = req.body;
    const result = await registrationsService.cancelRegistration(
      registrationId,
      cancellationReason,
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully and seat has been freed',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getWorkshopRegistrations = async (req, res, next) => {
  try {
    const { id: workshopId } = req.params;
    const data = await registrationsService.getWorkshopRegistrations(workshopId);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

const getAllRegistrationsHistory = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const history = await registrationsService.getAllRegistrationsHistory({ status, search });
    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerAttendee,
  cancelRegistration,
  getWorkshopRegistrations,
  getAllRegistrationsHistory,
};
