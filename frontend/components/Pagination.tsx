import React from 'react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPages(page: number, totalPages: number): number[] {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }
  return pages;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPages(page, totalPages);

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-2">
      <Button variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      {pages.map((value) => (
        <Button key={value} variant={value === page ? 'default' : 'outline'} onClick={() => onPageChange(value)}>
          {value}
        </Button>
      ))}
      <Button variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
};

export default Pagination;
