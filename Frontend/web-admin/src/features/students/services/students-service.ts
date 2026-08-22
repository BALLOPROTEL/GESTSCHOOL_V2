import { parseApiError } from "../../../shared/services/api-errors";
import type { Student } from "../../../shared/types/app";
import { DEFAULT_ESTABLISHMENT_VALUE, type StudentForm, type StudentsApiClient } from "../types/students";

export const parseStudentsError = parseApiError;

export const fetchStudents = async (api: StudentsApiClient): Promise<Student[]> => {
  const response = await api("/students");
  if (!response.ok) {
    throw new Error(await parseStudentsError(response));
  }
  return (await response.json()) as Student[];
};

export const saveStudent = async (
  api: StudentsApiClient,
  form: StudentForm,
  editingStudentId: string | null
): Promise<Student> => {
  const establishmentId =
    form.establishmentId === DEFAULT_ESTABLISHMENT_VALUE ? undefined : form.establishmentId || undefined;

  const response = await api(editingStudentId ? `/students/${editingStudentId}` : "/students", {
    method: editingStudentId ? "PATCH" : "POST",
    body: JSON.stringify({
      matricule: form.matricule.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      sex: form.sex,
      birthDate: form.birthDate || undefined,
      birthPlace: form.birthPlace.trim() || undefined,
      nationality: form.nationality.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      establishmentId,
      admissionDate: form.admissionDate || undefined,
      internalId: form.internalId.trim() || undefined,
      birthCertificateNo: form.birthCertificateNo.trim() || undefined,
      specialNeeds: form.specialNeeds.trim() || undefined,
      primaryLanguage: form.primaryLanguage.trim() || undefined,
      status: form.status,
      administrativeNotes: form.administrativeNotes.trim() || undefined
    })
  });
  if (!response.ok) {
    throw new Error(await parseStudentsError(response));
  }
  return (await response.json()) as Student;
};

export const archiveStudent = async (api: StudentsApiClient, studentId: string): Promise<void> => {
  const response = await api(`/students/${studentId}/archive`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseStudentsError(response));
  }
};
