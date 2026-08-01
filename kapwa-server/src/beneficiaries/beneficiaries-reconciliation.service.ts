import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './person.entity';

export interface DuplicateGroup {
  idA: string;
  idB: string;
  surnameSim: number;
  firstSim: number;
  dobA: Date;
  dobB: Date;
  surname: string;
  firstName: string;
}

@Injectable()
export class BeneficiariesReconciliationService {
  constructor(
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
  ) {}

  async findSuspectDuplicates(threshold = 0.75): Promise<DuplicateGroup[]> {
    return this.personRepo.query(
      `SELECT
        a.id AS "idA", b.id AS "idB",
        similarity(a.surname, b.surname) AS "surnameSim",
        similarity(a.first_name, b.first_name) AS "firstSim",
        a.dob AS "dobA", b.dob AS "dobB",
        a.surname, a.first_name AS "firstName"
      FROM persons a
      JOIN persons b ON a.id < b.id
      WHERE similarity(a.surname, b.surname) > $1
        AND similarity(a.first_name, b.first_name) > $1
        AND a.dob = b.dob
        AND a.merged_into_id IS NULL
        AND b.merged_into_id IS NULL
      ORDER BY (similarity(a.surname, b.surname) + similarity(a.first_name, b.first_name)) DESC`,
      [threshold],
    );
  }
}
