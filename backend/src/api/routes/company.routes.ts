import { Router } from "express";
import { CompanyController } from "@/api/controllers/company.controller";
import { authenticateJWT } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/authorization.middleware";
import { validateRequest, validateQuery } from "@/middleware/validation.middleware";
import {
  createCompanySchema,
  updateCompanySchema,
  companyFilterSchema,
} from "@/validators/company.validator";

const router = Router();
const companyController = new CompanyController();

router.get(
  "/",
  authenticateJWT,
  requirePermission("companies", "read"),
  validateQuery(companyFilterSchema),
  companyController.getAll
);

router.get(
  "/:id",
  authenticateJWT,
  requirePermission("companies", "read"),
  companyController.getById
);

router.get(
  "/:id/people",
  authenticateJWT,
  requirePermission("companies", "read"),
  companyController.getWithPeople
);

router.post(
  "/",
  authenticateJWT,
  requirePermission("companies", "create"),
  validateRequest(createCompanySchema),
  companyController.create
);

router.put(
  "/:id",
  authenticateJWT,
  requirePermission("companies", "update"),
  validateRequest(updateCompanySchema),
  companyController.update
);

router.delete(
  "/:id",
  authenticateJWT,
  requirePermission("companies", "delete"),
  companyController.delete
);

export default router;

