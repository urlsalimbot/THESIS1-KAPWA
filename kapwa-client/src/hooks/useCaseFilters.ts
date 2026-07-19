import { useState, useMemo } from 'react';
import type { PaginationState } from '@tanstack/react-table';

interface CaseRow {
  id: string;
  no: number;
  surname: string;
  first: string;
  middle: string;
  gender: string;
  ageRange: string;
  category: string;
  barangay: string;
  remarks: string;
  date: string;
  status: string;
  controlNo: string;
  slaOverdue?: boolean;
  createdAt: string;
}

export function useCaseFilters(cases: CaseRow[]) {
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [ageRangeFilter, setAgeRangeFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredCases = useMemo(() => cases.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${c.surname} ${c.first} ${c.middle}`.toLowerCase();
      if (!fullName.includes(q)) return false;
    }
    if (barangayFilter && c.barangay !== barangayFilter) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (genderFilter && c.gender.toLowerCase() !== genderFilter.toLowerCase()) return false;
    if (ageRangeFilter && c.ageRange !== ageRangeFilter) return false;
    if (slaFilter === 'overdue' && !c.slaOverdue) return false;
    if (slaFilter === 'on_track' && c.slaOverdue) return false;
    if (dateFrom && c.createdAt) {
      const from = new Date(dateFrom + 'T00:00:00Z');
      if (new Date(c.createdAt) < from) return false;
    }
    if (dateTo && c.createdAt) {
      const to = new Date(dateTo + 'T23:59:59Z');
      if (new Date(c.createdAt) > to) return false;
    }
    return true;
  }), [cases, search, barangayFilter, categoryFilter, statusFilter, genderFilter, ageRangeFilter, slaFilter, dateFrom, dateTo]);

  const hasAnyFilter = search || barangayFilter || categoryFilter || statusFilter || genderFilter || ageRangeFilter || slaFilter || dateFrom || dateTo;

  const uniqueBarangays = useMemo(() => [...new Set(cases.map(c => c.barangay).filter(Boolean))], [cases]);
  const uniqueCategories = useMemo(() => [...new Set(cases.map(c => c.category).filter(Boolean))], [cases]);
  const uniqueGenders = useMemo(() => [...new Set(cases.map(c => c.gender).filter(Boolean))], [cases]);
  const uniqueAgeRanges = useMemo(() => [...new Set(cases.map(c => c.ageRange).filter(Boolean))], [cases]);

  function clearFilters() {
    setSearch('');
    setBarangayFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setGenderFilter('');
    setAgeRangeFilter('');
    setSlaFilter('');
    setDateFrom('');
    setDateTo('');
  }

  return {
    search, setSearch,
    barangayFilter, setBarangayFilter,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    genderFilter, setGenderFilter,
    ageRangeFilter, setAgeRangeFilter,
    slaFilter, setSlaFilter,
    pagination, setPagination,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    filteredCases,
    hasAnyFilter,
    uniqueBarangays, uniqueCategories, uniqueGenders, uniqueAgeRanges,
    clearFilters,
  };
}
