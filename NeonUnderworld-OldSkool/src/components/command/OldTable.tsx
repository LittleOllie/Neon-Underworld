import type { ReactNode } from 'react';

interface OldTableProps {
  headers: string[];
  children: ReactNode;
  compact?: boolean;
}

export function OldTable({ headers, children, compact }: OldTableProps) {
  return (
    <table className={`old-table ${compact ? 'old-table--compact' : ''}`.trim()}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function ActivityRow({
  time,
  category,
  message,
}: {
  time: string;
  category: string;
  message: string;
}) {
  return (
    <tr>
      <td className="old-table-time">{time}</td>
      <td className="old-table-cat">{category}</td>
      <td>{message}</td>
    </tr>
  );
}
