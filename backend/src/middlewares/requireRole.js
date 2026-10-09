// src/middlewares/requireRole.js
// Use AFTER authenticateUser.  e.g.  router.get("/x", authenticateUser, requireRole("coe"), handler)

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }
    next();
  };
