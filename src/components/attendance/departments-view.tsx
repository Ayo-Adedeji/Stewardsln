"use client";

import EmptyState from "@/components/shared/empty-state";
import { FadeIn } from "@/components/shared/motion";
import PageHeader from "@/components/shared/page-header";
import { DepartmentStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAttendance } from "@/context/attendance-context";
import {
  AlertIcon,
  BuildingIcon,
  CheckCircleIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashBinIcon,
  UsersIcon,
} from "@/icons";
import type { Department } from "@/types/attendance";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const departmentSchema = z.object({
  name: z
    .string()
    .min(2, "Department name must be at least 2 characters.")
    .max(80, "Department name is too long."),
  code: z
    .string()
    .min(2, "Code must be 2–10 characters.")
    .max(10, "Code must be 2–10 characters."),
  leaderName: z
    .string()
    .min(2, "Please provide the department leader or coordinator name."),
  description: z
    .string()
    .min(5, "Please provide a brief description of the department."),
  memberCount: z.number().int().min(0, "Workforce size cannot be negative."),
  isEnabled: z.boolean(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function DepartmentsView() {
  const {
    departments,
    records,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
  } = useAttendance();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "enabled" | "disabled"
  >("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] =
    useState<Department | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      code: "",
      leaderName: "",
      description: "",
      memberCount: 10,
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (editingDepartment) {
      reset({
        name: editingDepartment.name,
        code: editingDepartment.code,
        leaderName: editingDepartment.leaderName,
        description: editingDepartment.description,
        memberCount: editingDepartment.memberCount,
        isEnabled: editingDepartment.isEnabled,
      });
    } else {
      reset({
        name: "",
        code: "",
        leaderName: "",
        description: "",
        memberCount: 10,
        isEnabled: true,
      });
    }
  }, [editingDepartment, reset]);

  const openAddModal = () => {
    setEditingDepartment(null);
    setModalError(null);
    setIsDialogOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDepartment(dept);
    setModalError(null);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: DepartmentFormValues) => {
    setModalError(null);

    // Duplicate check client-side
    const normName = values.name.trim().replace(/\s+/g, " ").toLowerCase();
    const normCode = values.code.trim().toUpperCase();

    const isDupName = departments.some(
      (d) =>
        (!editingDepartment || d.id !== editingDepartment.id) &&
        d.name.trim().replace(/\s+/g, " ").toLowerCase() === normName,
    );
    if (isDupName) {
      setModalError(
        `A department named "${values.name.trim()}" already exists. Department names must be unique.`,
      );
      return;
    }

    const isDupCode = departments.some(
      (d) =>
        (!editingDepartment || d.id !== editingDepartment.id) &&
        d.code.trim().toUpperCase() === normCode,
    );
    if (isDupCode) {
      setModalError(
        `A department with code "${normCode}" already exists.`,
      );
      return;
    }

    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, values);
      } else {
        await addDepartment(values);
      }
      setIsDialogOpen(false);
      setEditingDepartment(null);
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Failed to save department.",
      );
    }
  };

  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" ? dept.isEnabled : !dept.isEnabled);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        dept.name.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q) ||
        dept.leaderName.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [departments, statusFilter, searchQuery]);

  const checkInsByDept = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      map[r.departmentId] = (map[r.departmentId] || 0) + 1;
    }
    return map;
  }, [records]);

  const enabledCount = departments.filter((d) => d.isEnabled).length;
  const totalWorkforce = departments.reduce((acc, d) => acc + d.memberCount, 0);

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          subtitle="Workforce & Ministry Units"
          title="Church Departments"
          description="Manage Light Nation Ibadan workforce units, assign department leaders, and control which departments appear on the public attendance form."
          actions={
            <Button onClick={openAddModal}>
              <PlusIcon className="size-4" />
              Add Department
            </Button>
          }
        />
      </FadeIn>

      {/* Summary Cards */}
      <FadeIn delayMs={40}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Total Departments
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {departments.length}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
              <BuildingIcon className="size-5" />
            </span>
          </Card>

          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Enabled on Check-In Form
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {enabledCount}{" "}
                <span className="text-sm font-normal text-(--ln-fg-muted)">
                  of {departments.length}
                </span>
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="size-5" />
            </span>
          </Card>

          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Total Registered Workforce
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {totalWorkforce.toLocaleString()}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-amber-600 dark:text-amber-400">
              <UsersIcon className="size-5" />
            </span>
          </Card>
        </div>
      </FadeIn>

      {/* Department Listing Table Card */}
      <FadeIn delayMs={80}>
        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="ln-segmented">
              {(
                [
                  { id: "all", label: "All Units" },
                  { id: "enabled", label: "Active" },
                  { id: "disabled", label: "Disabled" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`ln-segment-item px-3 py-1.25 ${
                    statusFilter === tab.id
                      ? "ln-segment-item-active"
                      : "ln-segment-item-inactive"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-(--ln-fg-muted)" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search department, code, or leader..."
                className="h-9.5 ps-9.5 text-xs"
              />
            </div>
          </div>

          {filteredDepartments.length === 0 ? (
            <EmptyState
              icon={<BuildingIcon className="size-6" />}
              title="No departments found"
              description="Add a new ministry department or adjust your search filter."
              action={
                <Button size="sm" onClick={openAddModal}>
                  <PlusIcon className="size-4" />
                  Add Department
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-(--ln-border)">
                    <TableCell isHeader className="table-header-cell ps-0">
                      Department
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Department Head
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Workforce Size
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Status
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Check-In Access
                    </TableCell>
                    <TableCell
                      isHeader
                      className="table-header-cell pe-0 text-end"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-(--ln-border)/70">
                  {filteredDepartments.map((dept) => (
                    <TableRow
                      key={dept.id}
                      className="transition-colors hover:bg-(--ln-surface-warm)/40"
                    >
                      <TableCell className="table-body-cell ps-0">
                        <div className="flex items-start gap-3">
                          <Badge
                            variant="light"
                            color="primary"
                            size="sm"
                            className="mt-0.5 shrink-0 font-mono"
                          >
                            {dept.code}
                          </Badge>
                          <div>
                            <span className="block font-semibold text-(--ln-fg-primary)">
                              {dept.name}
                            </span>
                            <p className="mt-0.5 max-w-md text-xs text-(--ln-fg-muted)">
                              {dept.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="table-body-cell whitespace-nowrap">
                        <span className="font-medium text-(--ln-fg-primary)">
                          {dept.leaderName}
                        </span>
                      </TableCell>

                      <TableCell className="table-body-cell whitespace-nowrap">
                        <span className="tabular font-semibold text-(--ln-fg-primary)">
                          {dept.memberCount}
                        </span>{" "}
                        <span className="tabular text-xs text-(--ln-fg-muted)">
                          members ({checkInsByDept[dept.id] ?? 0} logs)
                        </span>
                      </TableCell>

                      <TableCell className="table-body-cell">
                        <DepartmentStatusBadge
                          isEnabled={dept.isEnabled}
                          size="sm"
                        />
                      </TableCell>

                      <TableCell className="table-body-cell">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={dept.isEnabled}
                            onCheckedChange={() => {
                              void toggleDepartmentStatus(dept.id);
                            }}
                            aria-label={`Toggle ${dept.name}`}
                          />
                          <span className="text-xs text-(--ln-fg-muted)">
                            {dept.isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="table-body-cell pe-0 text-end">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => openEditModal(dept)}
                          >
                            <PencilIcon className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Delete department"
                            aria-label={`Delete ${dept.name}`}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to remove "${dept.name}"? If you only wish to stop new registrations from selecting it, you can toggle its status off (deactivate) instead. Historical attendance records will remain preserved.`,
                                )
                              ) {
                                void deleteDepartment(dept.id);
                              }
                            }}
                            className="text-(--ln-fg-muted) hover:text-red-600 dark:hover:text-red-400"
                          >
                            <TrashBinIcon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </FadeIn>

      {/* Add / Edit Department Modal */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingDepartment(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Edit Department" : "Add Church Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? "Update the department details, leadership, or visibility on the public attendance form."
                : "Create a new workforce or ministry unit for Light Nation Ibadan attendance tracking."}
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300"
            >
              <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{modalError}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-2 space-y-4"
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                invalid={Boolean(errors.name)}
                className="sm:col-span-2"
              >
                <FieldLabel>
                  Department Name <span className="text-brand-600">*</span>
                </FieldLabel>
                <Input
                  placeholder="e.g. Light Nation Music & Choir"
                  {...register("name")}
                />
                {errors.name && (
                  <FieldError>{errors.name.message}</FieldError>
                )}
              </Field>

              <Field invalid={Boolean(errors.code)}>
                <FieldLabel>
                  Short Code <span className="text-brand-600">*</span>
                </FieldLabel>
                <Input
                  placeholder="e.g. LNM"
                  className="uppercase"
                  {...register("code")}
                />
                {errors.code && (
                  <FieldError>{errors.code.message}</FieldError>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                invalid={Boolean(errors.leaderName)}
                className="sm:col-span-2"
              >
                <FieldLabel>
                  Department Head / Coordinator{" "}
                  <span className="text-brand-600">*</span>
                </FieldLabel>
                <Input
                  placeholder="e.g. Min. Praise Adeyemi"
                  {...register("leaderName")}
                />
                {errors.leaderName && (
                  <FieldError>{errors.leaderName.message}</FieldError>
                )}
              </Field>

              <Field invalid={Boolean(errors.memberCount)}>
                <FieldLabel>Workforce Size</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  {...register("memberCount", { valueAsNumber: true })}
                />
                {errors.memberCount && (
                  <FieldError>{errors.memberCount.message}</FieldError>
                )}
              </Field>
            </div>

            <Field invalid={Boolean(errors.description)}>
              <FieldLabel>
                Description &amp; Responsibilities{" "}
                <span className="text-brand-600">*</span>
              </FieldLabel>
              <Textarea
                rows={3}
                placeholder="Describe this ministry unit's role during church services..."
                {...register("description")}
              />
              {errors.description && (
                <FieldError>{errors.description.message}</FieldError>
              )}
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/45 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-(--ln-fg-primary)">
                  Enable on Public Attendance Form
                </p>
                <p className="text-xs text-(--ln-fg-muted)">
                  Allow attendees to select this department during QR check-in
                </p>
              </div>
              <Controller
                control={control}
                name="isEnabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                )}
              />
            </div>

            <div className="flex flex-col-reverse justify-end gap-2.5 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                loadingText="Saving..."
              >
                {editingDepartment ? "Save Changes" : "Create Department"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
