/**
 * HR Nexus — Live Data Contracts
 *
 * All workforce records, attendance history, time-off requests, contracts,
 * working schedules, and payrun calculations are dynamically persisted and
 * loaded from the MySQL database through the centralized REST API services.
 *
 * Zero static mock records are permitted.
 */

import type { Employee, Payrun } from './types';

export const initialEmployees: Employee[] = [];
export const initialPayruns: Payrun[] = [];
