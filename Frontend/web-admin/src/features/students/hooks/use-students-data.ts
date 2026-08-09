import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { translateUiString, UI_MESSAGES } from "../../../shared/i18n";
import { useI18n } from "../../../shared/i18n-context";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import type { FieldErrors, Student } from "../../../shared/types/app";
import { focusFirstInlineErrorField, hasFieldErrors, today } from "../../../shared/utils/form-ui";
import { useConfirmDialog } from "../../../shared/components/confirm-dialog";
import { fetchStudents, removeStudent, saveStudent } from "../services/students-service";
import { DEFAULT_ESTABLISHMENT_VALUE, type StudentForm, type StudentsApiClient } from "../types/students";

type UseStudentsDataOptions = {
  api: StudentsApiClient;
  initialStudents: Student[];
  remoteEnabled?: boolean;
  onStudentsChange?: (students: Student[]) => void;
  onReloadEnrollments?: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const buildInitialStudentForm = (): StudentForm => ({
  matricule: "",
  firstName: "",
  lastName: "",
  sex: "M",
  birthDate: "",
  birthPlace: "",
  nationality: "",
  address: "",
  phone: "",
  email: "",
  establishmentId: DEFAULT_ESTABLISHMENT_VALUE,
  admissionDate: "",
  internalId: "",
  birthCertificateNo: "",
  specialNeeds: "",
  primaryLanguage: "",
  status: "ACTIVE",
  administrativeNotes: ""
});

const buildStudentFormFromRecord = (student: Student): StudentForm => ({
  matricule: student.matricule,
  firstName: student.firstName,
  lastName: student.lastName,
  sex: student.sex,
  birthDate: student.birthDate || "",
  birthPlace: student.birthPlace || "",
  nationality: student.nationality || "",
  address: student.address || "",
  phone: student.phone || "",
  email: student.email || "",
  establishmentId: student.establishmentId || DEFAULT_ESTABLISHMENT_VALUE,
  admissionDate: student.admissionDate || "",
  internalId: student.internalId || "",
  birthCertificateNo: student.birthCertificateNo || "",
  specialNeeds: student.specialNeeds || "",
  primaryLanguage: student.primaryLanguage || "",
  status: student.status || "ACTIVE",
  administrativeNotes: student.administrativeNotes || ""
});

export const useStudentsData = ({
  api,
  initialStudents,
  remoteEnabled = true,
  onStudentsChange,
  onReloadEnrollments,
  onError,
  onNotice
}: UseStudentsDataOptions) => {
  const { language } = useI18n();
  const confirmAction = useConfirmDialog();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<StudentForm>(() => buildInitialStudentForm());
  const [studentErrors, setStudentErrors] = useState<FieldErrors>({});
  const [studentWorkflowStep, setStudentWorkflowStep] = useState("list");

  const setStudentsAndNotify = useCallback(
    (nextStudents: Student[]) => {
      setStudents(nextStudents);
      onStudentsChange?.(nextStudents);
    },
    [onStudentsChange]
  );

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const loadStudents = useCallback(async (): Promise<void> => {
    if (!remoteEnabled) {
      setStudentsAndNotify(initialStudents);
      return;
    }

    try {
      setStudentsLoading(true);
      setStudentsAndNotify(await fetchStudents(api));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    } finally {
      setStudentsLoading(false);
    }
  }, [api, initialStudents, onError, remoteEnabled, setStudentsAndNotify]);

  const shownStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((item) =>
      [
        item.matricule,
        item.firstName,
        item.lastName,
        item.phone,
        item.email,
        item.status,
        ...(item.tracks || []),
        ...(item.parents || []).map((parent) => parent.parentName)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [studentSearch, students]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );

  const resetStudentForm = useCallback((): void => {
    setEditingStudentId(null);
    setStudentForm(buildInitialStudentForm());
    setStudentErrors({});
  }, []);

  const viewStudent = useCallback((student: Student): void => {
    setSelectedStudentId(student.id);
    setStudentWorkflowStep("list");
  }, []);

  const editStudent = useCallback((student: Student): void => {
    setEditingStudentId(student.id);
    setSelectedStudentId(student.id);
    setStudentForm(buildStudentFormFromRecord(student));
    setStudentWorkflowStep("entry");
  }, []);

  const submitStudent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!studentForm.matricule.trim()) errors.matricule = UI_MESSAGES.validationError;
    if (!studentForm.firstName.trim()) errors.firstName = UI_MESSAGES.validationError;
    if (!studentForm.lastName.trim()) errors.lastName = UI_MESSAGES.validationError;
    if (!studentForm.sex) errors.sex = UI_MESSAGES.validationError;
    if (!studentForm.establishmentId) errors.establishmentId = UI_MESSAGES.validationError;
    if (!studentForm.birthDate) {
      errors.birthDate = UI_MESSAGES.validationError;
    } else if (studentForm.birthDate > today()) {
      errors.birthDate = UI_MESSAGES.validationError;
    }
    if (!studentForm.status) errors.status = UI_MESSAGES.validationError;
    if (studentForm.admissionDate && studentForm.admissionDate > today()) {
      errors.admissionDate = UI_MESSAGES.validationError;
    }
    if (studentForm.email && !studentForm.email.includes("@")) {
      errors.email = UI_MESSAGES.validationError;
    }

    setStudentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }

    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await saveStudent(api, studentForm, editingStudentId);
      setStudentErrors({});
      resetStudentForm();
      onNotice(UI_MESSAGES.studentSaved);
      setStudentWorkflowStep("list");
      await loadStudents();
      await onReloadEnrollments?.();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    if (!(await confirmAction({
      description: translateUiString(language, UI_MESSAGES.studentArchiveConfirm),
      confirmLabel: translateUiString(language, "Archiver"),
      tone: "danger"
    }))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await removeStudent(api, studentId);
      if (editingStudentId === studentId) resetStudentForm();
      if (selectedStudentId === studentId) setSelectedStudentId(null);
      onNotice(UI_MESSAGES.studentArchived);
      await loadStudents();
      await onReloadEnrollments?.();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  return {
    deleteStudent,
    editStudent,
    editingStudentId,
    loadStudents,
    resetStudentForm,
    selectedStudent,
    setStudentForm,
    setStudentSearch,
    setStudentWorkflowStep,
    shownStudents,
    studentErrors,
    studentForm,
    studentSearch,
    students,
    studentsLoading,
    studentWorkflowStep,
    submitStudent,
    viewStudent
  };
};
