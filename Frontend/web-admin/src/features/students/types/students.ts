export type StudentsApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type StudentForm = {
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate: string;
  birthPlace: string;
  nationality: string;
  address: string;
  phone: string;
  email: string;
  establishmentId: string;
  admissionDate: string;
  internalId: string;
  birthCertificateNo: string;
  specialNeeds: string;
  primaryLanguage: string;
  status: string;
  administrativeNotes: string;
};
