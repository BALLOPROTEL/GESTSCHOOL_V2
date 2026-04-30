import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { FieldErrors, Student } from "../../../shared/types/app";
import { focusFirstInlineErrorField, hasFieldErrors, today } from "../../../shared/utils/form-ui";
import { fetchStudents, removeStudent, saveStudent } from "../services/students-service";
import type { StudentForm, StudentsApiClient } from "../types/students";

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
  establishmentId: "",
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
  establishmentId: student.establishmentId || "",
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
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<StudentForm>(() => buildInitialStudentForm());
  const [studentErrors, setStudentErrors] = useState<FieldErrors>({});
  const [studentWorkflowStep, setStudentWorkflowStep] = useState("entry");

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
      onError(error instanceof Error ? error.message : "Erreur de chargement des eleves.");
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

  const resetStudentForm = useCallback((): void => {
    setEditingStudentId(null);
    setStudentForm(buildInitialStudentForm());
    setStudentErrors({});
  }, []);

  const editStudent = useCallback((student: Student): void => {
    setEditingStudentId(student.id);
    setStudentForm(buildStudentFormFromRecord(student));
    setStudentWorkflowStep("entry");
  }, []);

  const submitStudent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!studentForm.matricule.trim()) errors.matricule = "Matricule requis.";
    if (!studentForm.firstName.trim()) errors.firstName = "Prenom requis.";
    if (!studentForm.lastName.trim()) errors.lastName = "Nom requis.";
    if (!studentForm.sex) errors.sex = "Sexe requis.";
    if (studentForm.birthDate && studentForm.birthDate > today()) {
      errors.birthDate = "Date de naissance invalide.";
    }
    if (studentForm.admissionDate && studentForm.admissionDate > today()) {
      errors.admissionDate = "Date d'admission invalide.";
    }
    if (studentForm.email && !studentForm.email.includes("@")) {
      errors.email = "Email invalide.";
    }

    setStudentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }

    if (!remoteEnabled) {
      onNotice("Mode apercu local : eleve non persiste.");
      return;
    }

    try {
      await saveStudent(api, studentForm, editingStudentId);
      setStudentErrors({});
      resetStudentForm();
      onNotice(editingStudentId ? "Eleve modifie." : "Eleve ajoute.");
      setStudentWorkflowStep("list");
      await loadStudents();
      await onReloadEnrollments?.();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de sauvegarde de l'eleve.");
    }
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    if (!window.confirm("Supprimer cet eleve ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode apercu local : suppression non persistee.");
      return;
    }

    try {
      await removeStudent(api, studentId);
      if (editingStudentId === studentId) resetStudentForm();
      onNotice("Eleve supprime.");
      await loadStudents();
      await onReloadEnrollments?.();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de suppression de l'eleve.");
    }
  };

  return {
    deleteStudent,
    editStudent,
    editingStudentId,
    loadStudents,
    resetStudentForm,
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
    submitStudent
  };
};
