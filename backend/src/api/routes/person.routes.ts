import { Router } from "express";
import { PersonController } from "@/api/controllers/person.controller";
import { authenticateJWT } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/authorization.middleware";
import { validateRequest, validateQuery } from "@/middleware/validation.middleware";
import {
  createPersonSchema,
  updatePersonSchema,
  personFilterSchema,
} from "@/validators/person.validator";

const router = Router();
const personController = new PersonController();

router.get(
  "/",
  authenticateJWT,
  requirePermission("people", "read"),
  validateQuery(personFilterSchema),
  personController.getAll
);

router.get(
  "/:id",
  authenticateJWT,
  requirePermission("people", "read"),
  personController.getById
);

router.get(
  "/company/:companyId",
  authenticateJWT,
  requirePermission("people", "read"),
  personController.getByCompany
);

router.post(
  "/",
  authenticateJWT,
  requirePermission("people", "create"),
  validateRequest(createPersonSchema),
  personController.create
);

router.put(
  "/:id",
  authenticateJWT,
  requirePermission("people", "update"),
  validateRequest(updatePersonSchema),
  personController.update
);

router.delete(
  "/:id",
  authenticateJWT,
  requirePermission("people", "delete"),
  personController.delete
);

export default router;

