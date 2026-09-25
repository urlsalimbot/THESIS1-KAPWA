import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Household } from '../beneficiaries/household.entity';
import type { HouseholdFeatureRow } from './analytics.types';

export interface FeatureFilters {
  from?: string;
  to?: string;
  barangay?: string;
}

interface RawFeatureRow {
  household_id: string;
  barangay: string | null;
  estimated_income: string | null;
  household_size: string;
  children_0_5: string;
  children_6_17: string;
  adults_18_59: string;
  seniors_60: string;
  has_pwd: boolean;
  has_solo_parent: boolean;
  has_4ps: boolean;
  case_count: string;
  intervention_count: string;
  total_assistance: string | null;
  days_since_last_case: string | null;
}

@Injectable()
export class AnalyticsFeaturesService {
  constructor(
    @InjectRepository(Household)
    private householdRepo: Repository<Household>,
  ) {}

  async getHouseholdFeatures(filters: FeatureFilters): Promise<HouseholdFeatureRow[]> {
    const rows: RawFeatureRow[] = await this.householdRepo.query(
      `WITH member_rollup AS (
         SELECT hm.household_id,
                COUNT(*) AS household_size,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) <= 5) AS children_0_5,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) BETWEEN 6 AND 17) AS children_6_17,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) BETWEEN 18 AND 59) AS adults_18_59,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) >= 60) AS seniors_60,
                BOOL_OR(br.category = 'PWD') AS has_pwd,
                BOOL_OR(br.category = 'Solo Parent') AS has_solo_parent,
                BOOL_OR(br.category = '4Ps') AS has_4ps
         FROM household_memberships hm
         JOIN persons p ON p.id = hm.person_id
         LEFT JOIN beneficiary_roles br ON br.person_id = p.id
         GROUP BY hm.household_id
       ),
       case_rollup AS (
         SELECT b.household_id,
                COUNT(DISTINCT c.id) AS case_count,
                COUNT(ci.id) AS intervention_count,
                COALESCE(SUM(ci.amount), 0) AS total_assistance,
                MAX(c.created_at::date) AS last_case_date
         FROM beneficiaries b
         LEFT JOIN cases c ON c.beneficiary_id = b.id
           AND ($1::date IS NULL OR c.created_at::date >= $1::date)
           AND ($2::date IS NULL OR c.created_at::date <= $2::date)
         LEFT JOIN case_interventions ci ON ci.case_id = c.id
           AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         WHERE b.household_id IS NOT NULL
         GROUP BY b.household_id
       )
       SELECT h.id AS household_id,
              h.barangay,
              h.estimated_income,
              mr.household_size, mr.children_0_5, mr.children_6_17, mr.adults_18_59, mr.seniors_60,
              COALESCE(mr.has_pwd, FALSE) AS has_pwd,
              COALESCE(mr.has_solo_parent, FALSE) AS has_solo_parent,
              COALESCE(mr.has_4ps, FALSE) AS has_4ps,
              COALESCE(cr.case_count, 0) AS case_count,
              COALESCE(cr.intervention_count, 0) AS intervention_count,
              COALESCE(cr.total_assistance, 0) AS total_assistance,
              (CURRENT_DATE - cr.last_case_date) AS days_since_last_case
       FROM households h
       JOIN member_rollup mr ON mr.household_id = h.id
       LEFT JOIN case_rollup cr ON cr.household_id = h.id
       WHERE ($3::text IS NULL OR h.barangay = $3)
       ORDER BY h.id`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );

    return (rows ?? []).map(row => ({
      householdId: row.household_id,
      barangay: row.barangay,
      values: {
        household_income: row.estimated_income != null ? Number(row.estimated_income) : null,
        household_size: Number(row.household_size),
        children_0_5: Number(row.children_0_5),
        children_6_17: Number(row.children_6_17),
        adults_18_59: Number(row.adults_18_59),
        seniors_60: Number(row.seniors_60),
        has_pwd: row.has_pwd ? 1 : 0,
        has_solo_parent: row.has_solo_parent ? 1 : 0,
        has_4ps: row.has_4ps ? 1 : 0,
        case_count: Number(row.case_count),
        intervention_count: Number(row.intervention_count),
        total_assistance: Number(row.total_assistance ?? 0),
        days_since_last_case: row.days_since_last_case != null ? Number(row.days_since_last_case) : null,
      },
    }));
  }

  async getRunMembers(
    runId: string,
    clusterIndex: number,
    page: number,
    limit: number,
  ): Promise<{ rows: Array<{ householdId: string; clusterIndex: number; distance: number | null; barangay: string | null }>; total: number }> {
    const offset = (page - 1) * limit;
    const rows = await this.householdRepo.query(
      `SELECT m.household_id, m.cluster_index, m.distance, h.barangay,
              COUNT(*) OVER() AS total
       FROM analysis_run_members m
       JOIN households h ON h.id = m.household_id
       WHERE m.run_id = $1 AND m.cluster_index = $2
       ORDER BY m.distance ASC
       LIMIT $3 OFFSET $4`,
      [runId, clusterIndex, limit, offset],
    );
    return {
      total: rows?.[0]?.total != null ? Number(rows[0].total) : 0,
      rows: (rows ?? []).map((r: any) => ({
        householdId: r.household_id,
        clusterIndex: Number(r.cluster_index),
        distance: r.distance != null ? Number(r.distance) : null,
        barangay: r.barangay ?? null,
      })),
    };
  }
}
