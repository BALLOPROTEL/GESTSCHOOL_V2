import type {
  ClassItem,
  SchoolYear,
  Subject,
  TeacherDetailRecord,
  TeacherDocumentRecord,
  TeacherPedagogicalAssignment,
  TeacherRecord,
  TeacherSkillRecord,
  TeacherWorkloadRecord
} from "../../shared/types/app";
import type { TeacherFilters, TeachersModuleData } from "./teachers-service";

type PreviewTeachersModuleData = TeachersModuleData & {
  details: TeacherDetailRecord[];
};

const now = "2026-06-01T08:00:00.000Z";

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesSearch = (teacher: TeacherRecord, search: string): boolean => {
  const query = normalize(search);
  if (!query) return true;
  return [
    teacher.fullName,
    teacher.matricule,
    teacher.email || "",
    teacher.primaryPhone || "",
    teacher.speciality || ""
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
};

export const filterPreviewTeachers = (
  teachers: TeacherRecord[],
  filters: TeacherFilters,
  skills: TeacherSkillRecord[]
): TeacherRecord[] =>
  teachers.filter((teacher) => {
    if (!matchesSearch(teacher, filters.search)) return false;
    if (filters.status && teacher.status !== filters.status) return false;
    if (filters.teacherType && teacher.teacherType !== filters.teacherType) return false;
    if (filters.track) {
      const hasTrack = skills.some((skill) => skill.teacherId === teacher.id && skill.track === filters.track);
      if (!hasTrack) return false;
    }
    if (filters.subjectId) {
      const hasSubject = skills.some(
        (skill) => skill.teacherId === teacher.id && skill.subjectId === filters.subjectId
      );
      if (!hasSubject) return false;
    }
    return true;
  });

export const buildPreviewTeachersModuleData = ({
  classes,
  schoolYears,
  subjects
}: {
  classes: ClassItem[];
  schoolYears: SchoolYear[];
  subjects: Subject[];
}): PreviewTeachersModuleData => {
  const activeYear = schoolYears.find((item) => item.isActive) || schoolYears[0];
  const francophoneClass = classes.find((item) => item.track === "FRANCOPHONE") || classes[0];
  const arabophoneClass = classes.find((item) => item.track === "ARABOPHONE") || classes[1] || classes[0];
  const francophoneSubject = subjects.find((item) => !item.isArabic) || subjects[0];
  const arabophoneSubject = subjects.find((item) => item.isArabic) || subjects[1] || subjects[0];

  const teachers: TeacherRecord[] = [
    {
      id: "preview-teacher-aminata",
      tenantId: "preview-tenant",
      matricule: "ENS-2025-001",
      firstName: "Aminata",
      lastName: "Coulibaly",
      fullName: "Aminata Coulibaly",
      sex: "F",
      birthDate: "1988-04-12",
      primaryPhone: "06 11 24 38 72",
      email: "aminata.coulibaly@almanarat.example",
      address: "Quartier administratif",
      nationality: "Malienne",
      hireDate: "2021-09-01",
      teacherType: "TITULAIRE",
      speciality: francophoneSubject?.label || "Mathématiques",
      mainDiploma: "Licence enseignement",
      teachingLanguage: "Français",
      status: "ACTIVE",
      activeAssignmentsCount: 2,
      workloadHoursTotal: 18,
      francophoneWorkloadHoursTotal: 14,
      arabophoneWorkloadHoursTotal: 4,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "preview-teacher-oumar",
      tenantId: "preview-tenant",
      matricule: "ENS-2025-002",
      firstName: "Oumar",
      lastName: "Ben Salah",
      fullName: "Oumar Ben Salah",
      sex: "M",
      birthDate: "1982-11-20",
      primaryPhone: "06 45 80 19 33",
      email: "oumar.bensalah@almanarat.example",
      address: "Secteur Est",
      nationality: "Sénégalaise",
      hireDate: "2020-10-05",
      teacherType: "VACATAIRE",
      speciality: arabophoneSubject?.label || "Arabe / Éducation islamique",
      mainDiploma: "Master langue arabe",
      teachingLanguage: "Arabe",
      status: "ACTIVE",
      activeAssignmentsCount: 1,
      workloadHoursTotal: 12,
      francophoneWorkloadHoursTotal: 0,
      arabophoneWorkloadHoursTotal: 12,
      createdAt: now,
      updatedAt: now
    }
  ];

  const assignments: TeacherPedagogicalAssignment[] = [
    {
      id: "preview-assignment-aminata-fr",
      teacherId: teachers[0].id,
      teacherName: teachers[0].fullName,
      schoolYearId: activeYear?.id || "preview-year",
      schoolYearCode: activeYear?.code || "2025-2026",
      classId: francophoneClass?.id || "preview-class-fr",
      classLabel: francophoneClass?.label || "CM2 A",
      levelId: francophoneClass?.levelId,
      subjectId: francophoneSubject?.id || "preview-subject-math",
      subjectLabel: francophoneSubject?.label || "Mathématiques",
      track: "FRANCOPHONE",
      workloadHours: 14,
      isHomeroomTeacher: true,
      role: "Professeure principale",
      startDate: activeYear?.startDate || "2025-09-12",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "preview-assignment-aminata-ar",
      teacherId: teachers[0].id,
      teacherName: teachers[0].fullName,
      schoolYearId: activeYear?.id || "preview-year",
      schoolYearCode: activeYear?.code || "2025-2026",
      classId: arabophoneClass?.id || "preview-class-ar",
      classLabel: arabophoneClass?.label || "Arabe 5 A",
      levelId: arabophoneClass?.levelId,
      subjectId: arabophoneSubject?.id || "preview-subject-ar",
      subjectLabel: arabophoneSubject?.label || "Langue arabe",
      track: "ARABOPHONE",
      workloadHours: 4,
      isHomeroomTeacher: false,
      startDate: activeYear?.startDate || "2025-09-12",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "preview-assignment-oumar-ar",
      teacherId: teachers[1].id,
      teacherName: teachers[1].fullName,
      schoolYearId: activeYear?.id || "preview-year",
      schoolYearCode: activeYear?.code || "2025-2026",
      classId: arabophoneClass?.id || "preview-class-ar",
      classLabel: arabophoneClass?.label || "Arabe 5 A",
      levelId: arabophoneClass?.levelId,
      subjectId: arabophoneSubject?.id || "preview-subject-ar",
      subjectLabel: arabophoneSubject?.label || "Langue arabe",
      track: "ARABOPHONE",
      workloadHours: 12,
      isHomeroomTeacher: true,
      role: "Référent arabophone",
      startDate: activeYear?.startDate || "2025-09-12",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    }
  ];

  const skills: TeacherSkillRecord[] = assignments.map((assignment, index) => ({
    id: `preview-skill-${index + 1}`,
    teacherId: assignment.teacherId,
    teacherName: assignment.teacherName,
    subjectId: assignment.subjectId,
    subjectLabel: assignment.subjectLabel,
    track: assignment.track,
    levelId: assignment.levelId,
    levelLabel: assignment.levelLabel,
    qualification: index === 2 ? "Référent confirmé" : "Autorisé",
    yearsExperience: index === 2 ? 9 : 5,
    priority: index + 1,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now
  }));

  const workloads: TeacherWorkloadRecord[] = teachers.map((teacher) => {
    const teacherAssignments = assignments.filter((assignment) => assignment.teacherId === teacher.id);
    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      matricule: teacher.matricule,
      status: teacher.status,
      assignmentsCount: teacherAssignments.length,
      workloadHoursTotal: teacher.workloadHoursTotal,
      francophoneHoursTotal: teacher.francophoneWorkloadHoursTotal,
      arabophoneHoursTotal: teacher.arabophoneWorkloadHoursTotal,
      francophoneAssignmentsCount: teacherAssignments.filter((assignment) => assignment.track === "FRANCOPHONE").length,
      arabophoneAssignmentsCount: teacherAssignments.filter((assignment) => assignment.track === "ARABOPHONE").length,
      classesCount: new Set(teacherAssignments.map((assignment) => assignment.classId)).size,
      subjectsCount: new Set(teacherAssignments.map((assignment) => assignment.subjectId)).size,
      classes: Array.from(new Set(teacherAssignments.map((assignment) => assignment.classLabel || ""))).filter(Boolean),
      subjects: Array.from(new Set(teacherAssignments.map((assignment) => assignment.subjectLabel || ""))).filter(Boolean)
    };
  });

  const documents: TeacherDocumentRecord[] = [];
  const details = teachers.map((teacher) => ({
    ...teacher,
    skills: skills.filter((skill) => skill.teacherId === teacher.id),
    assignments: assignments.filter((assignment) => assignment.teacherId === teacher.id),
    documents
  }));

  return {
    assignments,
    details,
    documents,
    skills,
    teachers,
    workloads
  };
};
