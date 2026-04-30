import type { JSX } from "react";

import type { Student } from "../../shared/types/app";
import { StudentsPanel } from "./components/students-panel";
import { useStudentsData } from "./hooks/use-students-data";
import type { StudentsApiClient } from "./types/students";

type StudentsScreenProps = {
  api: StudentsApiClient;
  initialStudents: Student[];
  remoteEnabled?: boolean;
  onStudentsChange?: (students: Student[]) => void;
  onReloadEnrollments?: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

export function StudentsScreen({
  api,
  initialStudents,
  remoteEnabled,
  onStudentsChange,
  onReloadEnrollments,
  onError,
  onNotice
}: StudentsScreenProps): JSX.Element {
  const {
    deleteStudent,
    editStudent,
    editingStudentId,
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
  } = useStudentsData({
    api,
    initialStudents,
    remoteEnabled,
    onStudentsChange,
    onReloadEnrollments,
    onError,
    onNotice
  });

  return (
    <StudentsPanel
      editingStudentId={editingStudentId}
      studentErrors={studentErrors}
      studentForm={studentForm}
      studentSearch={studentSearch}
      studentWorkflowStep={studentWorkflowStep}
      students={students}
      studentsLoading={studentsLoading}
      shownStudents={shownStudents}
      onDeleteStudent={(studentId) => void deleteStudent(studentId)}
      onEditStudent={editStudent}
      onResetStudentForm={resetStudentForm}
      onSearchChange={setStudentSearch}
      onStudentFormChange={setStudentForm}
      onStudentWorkflowStepChange={setStudentWorkflowStep}
      onSubmitStudent={(event) => void submitStudent(event)}
    />
  );
}
