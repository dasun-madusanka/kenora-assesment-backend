const usersService = require('./users.service');

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await usersService.createUser(
      { name, email, password, role },
      req.user.id
    );
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await usersService.getAllUsers();
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await usersService.updateUserRole(id, role, req.user.id);
    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createUser,
  getAllUsers,
  updateUserRole,
};
