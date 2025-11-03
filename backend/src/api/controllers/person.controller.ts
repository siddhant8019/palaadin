import { Request, Response, NextFunction } from "express";
import { PersonService } from "@/services/person.service";
import {
  CreatePersonInput,
  UpdatePersonInput,
  PersonFilterInput,
} from "@/validators/person.validator";

export class PersonController {
  constructor(private personService: PersonService = new PersonService()) {}

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const filters = req.query as PersonFilterInput;

      const result = await this.personService.searchPeople(filters, {
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const person = await this.personService.getPersonById(id);

      res.status(200).json({
        success: true,
        data: person,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = req.body as CreatePersonInput;
      const person = await this.personService.createPerson(data);

      res.status(201).json({
        success: true,
        message: "Person created successfully",
        data: person,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePersonInput;

      const person = await this.personService.updatePerson(id, data);

      res.status(200).json({
        success: true,
        message: "Person updated successfully",
        data: person,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.personService.deletePerson(id);

      res.status(200).json({
        success: true,
        message: "Person deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getByCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { companyId } = req.params;
      const filters = req.query as PersonFilterInput;

      const result = await this.personService.getPeopleByCompany(companyId, {
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

