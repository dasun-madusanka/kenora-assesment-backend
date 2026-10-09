const waitlistService = require('./waitlist.service');

const addToWaitlist = async (req, res, next) => {
  try {
    const { id: workshopId } = req.params;
    const { attendeeName, attendeeEmail } = req.body;
    const entry = await waitlistService.addToWaitlist(
      workshopId,
      { attendeeName, attendeeEmail },
      req.user.id
    );
    res.status(201).json({
      success: true,
      message: 'Attendee successfully queued in the waitlist',
      data: entry,
    });
  } catch (err) {
    next(err);
  }
};

const getWorkshopWaitlist = async (req, res, next) => {
  try {
    const { id: workshopId } = req.params;
    const data = await waitlistService.getWorkshopWaitlist(workshopId);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addToWaitlist,
  getWorkshopWaitlist,
};
