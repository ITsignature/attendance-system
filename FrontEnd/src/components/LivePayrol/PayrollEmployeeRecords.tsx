import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Alert, Spinner, Button } from "flowbite-react";
import { apiService } from '../../services/api';

interface LiveRecord { /* same as before */ }

const PayrollEmployeeRecords: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRecords, setLiveRecords] = useState<LiveRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const loadLiveData = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const response = await apiService.getPayrollLiveAll({ month, year, page: pageNum, limit });

      if (response.success) {
        setLiveRecords(response.data);
        setTotalPages(Math.ceil(response.total / limit));
        setPage(response.page);
      } else {
        setError(response.message || 'Failed to load live data');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLiveData(page); }, [loadLiveData, page]);

  // Re-render every second to update live session hours
  useEffect(() => {
    const interval = setInterval(() => setLiveRecords(prev => [...prev]), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount?: number | null) => `Rs. ${(amount ?? 0).toLocaleString()}`;

  const calculateRealtimeSalary = (record: LiveRecord) => {
    const base = record.live.base_salary ?? 0;
    const live = record.live;

    // Dynamic session hours if currently checked in
    let dynamicHours = 0;
    if (live.last_check_in_time) {
      const now = new Date();
      const [h, m, s] = live.last_check_in_time.split(':').map(Number);
      const checkIn = new Date();
      checkIn.setHours(h, m, s, 0);
      dynamicHours = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60); // convert ms to hours
    }

    // Total hours = paid hours + overtime + dynamic session
    const totalHours =
      (live.sum_of_weekday_payable_hours ?? 0) +
      (live.sum_of_saturday_payable_hours ?? 0) +
      (live.sum_of_sunday_payable_hours ?? 0) +
      (live.overtime_hours ?? 0) +
      dynamicHours;

    // Monthly scheduled hours
    const monthlyHours =
      (live.weekdays_of_month * 8) +
      (live.saturdays_of_month * 5) +
      (live.sundays_of_month * 0); // Sundays unpaid

    const gross = monthlyHours > 0 ? base * (totalHours / monthlyHours) : base;
    const net = gross;

    return { gross, net };
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="xl" />
      <span className="ml-3 text-lg">Loading...</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {error && <Alert color="failure" onDismiss={() => setError(null)}>{error}</Alert>}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Employee</Table.HeadCell>
              <Table.HeadCell>Base Salary</Table.HeadCell>
              <Table.HeadCell>Gross Salary</Table.HeadCell>
              <Table.HeadCell>Net Salary</Table.HeadCell>
              <Table.HeadCell>Current Session</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {liveRecords.length > 0 ? liveRecords.map(record => {
                const { gross, net } = calculateRealtimeSalary(record);
                return (
                  <Table.Row key={record.employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                    <Table.Cell>{record.employee.name}</Table.Cell>
                    <Table.Cell>{formatCurrency(record.live.base_salary)}</Table.Cell>
                    <Table.Cell>{formatCurrency(gross)}</Table.Cell>
                    <Table.Cell>{formatCurrency(net)}</Table.Cell>
                    <Table.Cell>
                      {record.live.last_check_in_time ? `${record.live.last_check_in_time} (live)` : '-'}
                    </Table.Cell>
                  </Table.Row>
                );
              }) : (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-8 text-gray-500">
                    No live employee records found.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>

        <div className="flex justify-between mt-4">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {totalPages}</span>
          <Button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </Card>
    </div>
  );
};

export default PayrollEmployeeRecords;
