import React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

export const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <label className={cn("block space-y-1.5", className)}>
    <span className="text-[11px] text-fg-muted">{label}</span>
    {children}
  </label>
);

export const AddBar = ({
  onAdd,
  disabled,
  label = "إضافة",
}: {
  onAdd: () => void;
  disabled?: boolean;
  label?: string;
}) => (
  <Button type="button" onClick={onAdd} disabled={disabled} className="shrink-0">
    <Plus className="h-4 w-4" />
    {label}
  </Button>
);

const RowActions = ({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete: () => void;
}) => (
  <div className="flex shrink-0 items-center">
    {onEdit ? (
      <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="تعديل">
        <Pencil className="h-4 w-4" />
      </Button>
    ) : null}
    <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="حذف">
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
);

export const SimpleList = ({
  items,
  empty,
  onDelete,
  onEdit,
  renderMeta,
}: {
  items: Array<{ id: string; name: string }>;
  empty: string;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
  renderMeta?: (item: { id: string; name: string }) => React.ReactNode;
}) => {
  if (items.length === 0) {
    return <EmptyState title={empty} className="py-10" />;
  }

  return (
    <ul className="divide-y divide-line border border-line">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] text-fg">{item.name}</p>
            {renderMeta ? (
              <p className="mt-0.5 text-[11px] text-fg-muted">{renderMeta(item)}</p>
            ) : null}
          </div>
          <RowActions
            onEdit={onEdit ? () => onEdit(item.id) : undefined}
            onDelete={() => onDelete(item.id)}
          />
        </li>
      ))}
    </ul>
  );
};

export const RuleTable = ({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{
    id: string;
    cells: React.ReactNode[];
    onDelete: () => void;
    onEdit?: () => void;
  }>;
  empty: string;
}) => {
  if (rows.length === 0) {
    return <EmptyState title={empty} className="py-10" />;
  }

  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface-sunken">
            {headers.map((header) => (
              <th
                key={header}
                className="h-9 px-3 text-start text-[11px] font-medium text-fg-muted"
              >
                {header}
              </th>
            ))}
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.cells.map((cell, index) => (
                <td key={index} className="px-3 py-2 align-middle">
                  {cell}
                </td>
              ))}
              <td className="px-2 py-1">
                <RowActions onEdit={row.onEdit} onDelete={row.onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
