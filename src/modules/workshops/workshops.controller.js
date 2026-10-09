const workshopsService = require('./workshops.service');

const getWorkshops = async (req, res, next) => {
  try {
    const { from, to, status, seatsAvailable, search } = req.query;
    const workshops = await workshopsService.getWorkshops({
      from,
      to,
      status,
      seatsAvailable,
      search,
    });
    res.status(200).json({
      success: true,
      count: workshops.length,
      data: workshops,
    });
  } catch (err) {
    next(err);
  }
};

const getWorkshopById = async (req, res, next) => {
  try {
    const workshop = await workshopsService.getWorkshopById(req.params.id);
    res.status(200).json({
      success: true,
      data: workshop,
    });
  } catch (err) {
    next(err);
  }
};

const createWorkshop = async (req, res, next) => {
  try {
    const workshop = await workshopsService.createWorkshop(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Workshop created successfully',
      data: workshop,
    });
  } catch (err) {
    next(err);
  }
};

const updateWorkshop = async (req, res, next) => {
  try {
    const workshop = await workshopsService.updateWorkshop(
      req.params.id,
      req.body,
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: 'Workshop updated successfully',
      data: workshop,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWorkshops,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
};
