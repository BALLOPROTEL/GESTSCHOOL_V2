import type { Student } from "../../../shared/types/app";
import type { StudentForm, StudentsApiClient } from "../types/students";

export const parseStudentsError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a stable fallback for non-JSON API errors.
  }
  return `Erreur HTTP ${response.status}`;
};

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
      establishmentId: form.establishmentId || undefined,
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

export const removeStudent = async (api: StudentsApiClient, studentId: string): Promise<void> => {
  const response = await api(`/students/${studentId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseStudentsError(response));
  }
};
