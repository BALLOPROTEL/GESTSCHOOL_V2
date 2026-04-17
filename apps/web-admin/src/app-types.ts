export type Session = {
  accessToken: string;
  refreshToken: string;
  user: { username: string; role: string; tenantId: string };
  tenantId: string;
};

export type Student = {
  id: string;
  tenantId?: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  sex: "M" | "F";
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  establishmentId?: string;
  admissionDate?: string;
  administrativeNotes?: string;
  internalId?: string;
  birthCertificateNo?: string;
  specialNeeds?: string;
  primaryLanguage?: string;
  userId?: string;
  status?: string;
  archivedAt?: string;
  tracks?: AcademicTrack[];
  placements?: StudentPlacement[];
  parents?: StudentParentSummary[];
  createdAt?: string;
  updatedAt?: string;
};

export type AcademicTrack = "FRANCOPHONE" | "ARABOPHONE";
export type RotationGroup = "GROUP_A" | "GROUP_B";
export type AcademicPlacementStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "COMPLETED";
export type AcademicStage = "PRIMARY" | "SECONDARY" | "HIGHER";
export type ReportCardMode = "TRACK_SINGLE" | "PRIMARY_COMBINED";
export type SchoolYearStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ReferenceStatus = "ACTIVE" | "INACTIVE";
export type PeriodStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type SubjectNature = "FRANCOPHONE" | "ARABOPHONE";

export type SchoolYear = {
  id: string;
  code: string;
  label?: string;
  startDate?: string;
  endDate?: string;
  status?: SchoolYearStatus;
  previousYearId?: string;
  isActive: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  comment?: string;
};
export type Cycle = {
  id: string;
  schoolYearId?: string;
  code: string;
  label: string;
  academicStage: AcademicStage;
  sortOrder?: number;
  description?: string;
  theoreticalAgeMin?: number;
  theoreticalAgeMax?: number;
  status?: ReferenceStatus;
};
export type Level = {
  id: string;
  cycleId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  alias?: string;
  sortOrder?: number;
  status?: ReferenceStatus;
  theoreticalAge?: number;
  description?: string;
  defaultSection?: string;
  rotationGroup?: RotationGroup;
};
export type ClassItem = {
  id: string;
  schoolYearId: string;
  levelId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  capacity?: number;
  status?: ReferenceStatus;
  homeroomTeacherName?: string;
  mainRoom?: string;
  actualCapacity?: number;
  filiere?: string;
  series?: string;
  speciality?: string;
  description?: string;
  teachingMode?: string;
  rotationGroup?: RotationGroup;
};
export type Subject = {
  id: string;
  code: string;
  label: string;
  isArabic: boolean;
  status?: ReferenceStatus;
  nature?: SubjectNature;
  shortLabel?: string;
  defaultCoefficient?: number;
  category?: string;
  description?: string;
  color?: string;
  weeklyHours?: number;
  isGraded?: boolean;
  isOptional?: boolean;
  levelIds?: string[];
};
export type Period = {
  id: string;
  schoolYearId: string;
  code: string;
  label: string;
  startDate?: string;
  endDate?: string;
  periodType: string;
  sortOrder?: number;
  status?: PeriodStatus;
  parentPeriodId?: string;
  isGradeEntryOpen?: boolean;
  gradeEntryDeadline?: string;
  lockDate?: string;
  comment?: string;
};

export type Enrollment = {
  id: string;
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: AcademicTrack;
  placementId?: string;
  isPrimary?: boolean;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
  primaryClassLabel?: string;
  secondaryClassLabel?: string;
  primaryTrack?: AcademicTrack;
  secondaryTrack?: AcademicTrack;
};

export type StudentPlacement = {
  placementId: string;
  track: AcademicTrack;
  placementStatus: string;
  isPrimary: boolean;
  schoolYearId: string;
  schoolYearCode?: string;
  levelId: string;
  levelLabel?: string;
  classId?: string;
  classLabel?: string;
};

export type StudentParentSummary = {
  linkId: string;
  parentId?: string;
  parentUserId?: string;
  parentName: string;
  parentUsername?: string;
  relationType?: string;
  isPrimaryContact: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  pickupAuthorized?: boolean;
  status: string;
};

export type FeePlan = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

export type Invoice = {
  id: string;
  studentId: string;
  schoolYearId: string;
  feePlanId?: string;
  billingPlacementId?: string;
  secondaryPlacementId?: string;
  invoiceNo: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  status: string;
  dueDate?: string;
  studentName?: string;
  schoolYearCode?: string;
  feePlanLabel?: string;
  primaryTrack?: AcademicTrack;
  primaryClassId?: string;
  primaryClassLabel?: string;
  primaryLevelId?: string;
  primaryLevelLabel?: string;
  secondaryTrack?: AcademicTrack;
  secondaryClassId?: string;
  secondaryClassLabel?: string;
  secondaryLevelId?: string;
  secondaryLevelLabel?: string;
};

export type PaymentRecord = {
  id: string;
  invoiceId: string;
  invoiceNo?: string;
  studentId?: string;
  studentName?: string;
  schoolYearId?: string;
  receiptNo: string;
  paidAmount: number;
  paymentMethod: string;
  paidAt: string;
  referenceExternal?: string;
};

export type RecoveryDashboard = {
  totals: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
  };
  invoices: {
    total: number;
    open: number;
    partial: number;
    paid: number;
    void: number;
  };
};

export type GradeEntry = {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  placementId?: string;
  track: AcademicTrack;
  subjectId: string;
  subjectLabel?: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: number;
  scoreMax: number;
  absent: boolean;
};

export type ClassSummaryStudent = {
  studentId: string;
  placementId?: string;
  track: AcademicTrack;
  matricule: string;
  studentName: string;
  averageGeneral: number;
  classRank: number;
  noteCount: number;
  appreciation: string;
};

export type ClassSummary = {
  classId: string;
  academicPeriodId: string;
  track: AcademicTrack;
  classAverage: number;
  students: ClassSummaryStudent[];
};

export type ReportCard = {
  id: string;
  studentId: string;
  classId: string;
  placementId?: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
  secondaryClassLabel?: string;
  sections?: Array<{
    placementId?: string;
    track: AcademicTrack;
    classId: string;
    classLabel?: string;
    levelCode?: string;
    levelLabel?: string;
    academicStage: AcademicStage;
    averageGeneral: number;
    classRank?: number;
    appreciation: string;
    subjectAverages: Array<{
      subjectId: string;
      subjectLabel: string;
      average: number;
    }>;
  }>;
};

export type WorkflowStepDef = {
  id: string;
  title: string;
  hint: string;
  done?: boolean;
};

export type FieldErrors = Record<string, string>;
export type ThemeMode = "light" | "dark";
export type RememberedLogin = {
  username: string;
  tenantId?: string;
  remember: boolean;
};
export type ForgotPasswordResponse = {
  message: string;
};
export type AuthMessageResponse = {
  message: string;
};

export type Role = "ADMIN" | "SCOLARITE" | "ENSEIGNANT" | "COMPTABLE" | "PARENT" | "STUDENT";
export type AccountType = "STAFF" | "TEACHER" | "PARENT" | "STUDENT";
export type PasswordMode = "AUTO" | "MANUAL";

export type UserAccount = {
  id: string;
  tenantId: string;
  username: string;
  role: Role;
  roleId?: Role;
  accountType?: AccountType;
  email?: string;
  phone?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  establishmentId?: string;
  staffFunction?: string;
  department?: string;
  notes?: string;
  mustChangePasswordAtFirstLogin?: boolean;
  teacherId?: string;
  parentId?: string;
  studentId?: string;
  temporaryPassword?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PermissionResource =
  | "students"
  | "parents"
  | "teachers"
  | "rooms"
  | "users"
  | "teacherPortal"
  | "parentPortal"
  | "enrollments"
  | "reference"
  | "finance"
  | "payments"
  | "grades"
  | "reportCards"
  | "attendance"
  | "attendanceAttachment"
  | "attendanceValidation"
  | "timetable"
  | "notifications"
  | "mosque"
  | "analytics"
  | "audit";

export type PermissionAction = "read" | "create" | "update" | "delete" | "validate" | "dispatch";

export type RolePermissionView = {
  role: Role;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  source: "DEFAULT" | "CUSTOM";
};

export type TeacherRecord = {
  id: string;
  tenantId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: "M" | "F";
  birthDate?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  nationality?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  hireDate?: string;
  teacherType: string;
  speciality?: string;
  mainDiploma?: string;
  teachingLanguage?: string;
  status: string;
  establishmentId?: string;
  userId?: string;
  userUsername?: string;
  internalNotes?: string;
  archivedAt?: string;
  activeAssignmentsCount: number;
  workloadHoursTotal: number;
  francophoneWorkloadHoursTotal: number;
  arabophoneWorkloadHoursTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherSkillRecord = {
  id: string;
  teacherId: string;
  teacherName?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  cycleId?: string;
  cycleLabel?: string;
  levelId?: string;
  levelLabel?: string;
  qualification?: string;
  yearsExperience?: number;
  priority?: number;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherPedagogicalAssignment = {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  periodId?: string;
  periodLabel?: string;
  workloadHours?: number;
  coefficient?: number;
  isHomeroomTeacher: boolean;
  role?: string;
  startDate: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDocumentRecord = {
  id: string;
  teacherId: string;
  teacherName?: string;
  documentType: string;
  fileUrl: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByUsername?: string;
  status: string;
  archivedAt?: string;
};

export type TeacherDetailRecord = TeacherRecord & {
  skills: TeacherSkillRecord[];
  assignments: TeacherPedagogicalAssignment[];
  documents: TeacherDocumentRecord[];
};

export type TeacherWorkloadRecord = {
  teacherId: string;
  teacherName: string;
  matricule: string;
  status: string;
  assignmentsCount: number;
  workloadHoursTotal: number;
  francophoneHoursTotal: number;
  arabophoneHoursTotal: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  classesCount: number;
  subjectsCount: number;
  classes: string[];
  subjects: string[];
};

export type RoomTypeRecord = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomRecord = {
  id: string;
  code: string;
  name: string;
  building?: string;
  floor?: string;
  location?: string;
  description?: string;
  roomTypeId: string;
  roomTypeName?: string;
  capacity: number;
  examCapacity?: number;
  status: string;
  isSharedBetweenCurricula: boolean;
  defaultTrack?: AcademicTrack;
  establishmentId?: string;
  notes?: string;
  activeAssignmentsCount: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAssignmentRecord = {
  id: string;
  roomId: string;
  roomLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId?: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  cycleId?: string;
  cycleLabel?: string;
  track?: AcademicTrack;
  subjectId?: string;
  subjectLabel?: string;
  periodId?: string;
  periodLabel?: string;
  assignmentType: string;
  startDate?: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAvailabilityRecord = {
  id: string;
  roomId: string;
  roomLabel?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  availabilityType: string;
  schoolYearId?: string;
  schoolYearCode?: string;
  periodId?: string;
  periodLabel?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomDetailRecord = RoomRecord & {
  assignments: RoomAssignmentRecord[];
  availabilities: RoomAvailabilityRecord[];
};

export type RoomOccupancyRecord = {
  roomId: string;
  roomLabel: string;
  roomTypeName?: string;
  capacity: number;
  status: string;
  defaultTrack?: AcademicTrack;
  isSharedBetweenCurricula: boolean;
  assignmentsCount: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  sharedAssignmentsCount: number;
  classes: string[];
  subjects: string[];
};

export type ParentRecord = {
  id: string;
  tenantId: string;
  parentalRole: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  profession?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  status: string;
  establishmentId?: string;
  userId?: string;
  userUsername?: string;
  notes?: string;
  childrenCount: number;
  primaryChildrenCount: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentStudentRelation = {
  id: string;
  tenantId: string;
  parentId?: string;
  parentUserId?: string;
  studentId: string;
  relationType: string;
  relationship?: string;
  isPrimary: boolean;
  isPrimaryContact: boolean;
  livesWithStudent?: boolean;
  pickupAuthorized?: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  status: string;
  comment?: string;
  parentName?: string;
  parentUsername?: string;
  studentMatricule: string;
  studentName: string;
  studentTracks: AcademicTrack[];
  studentPlacements: StudentPlacement[];
  createdAt: string;
  updatedAt: string;
};

export type TeacherOverview = {
  classesCount: number;
  studentsCount: number;
  gradesCount: number;
  pendingJustifications: number;
  timetableSlotsCount: number;
  notificationsCount: number;
};

export type TeacherClass = {
  assignmentId: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
  track?: AcademicTrack;
  subjectId?: string;
  subjectLabel?: string;
};

export type TeacherStudent = {
  enrollmentId: string;
  placementId?: string;
  studentId: string;
  matricule: string;
  studentName: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
  track?: AcademicTrack;
  placementStatus?: AcademicPlacementStatus;
  isPrimary?: boolean;
};

export type PortalNotification = {
  id: string;
  studentId?: string;
  studentName?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
};

export type ParentOverview = {
  childrenCount: number;
  openInvoicesCount: number;
  remainingAmount: number;
  absencesCount: number;
  reportCardsCount: number;
  notificationsCount: number;
};

export type TrackPlacementSummary = {
  placementId: string;
  enrollmentId?: string;
  track: AcademicTrack;
  placementStatus: AcademicPlacementStatus;
  isPrimary: boolean;
  levelId: string;
  levelCode: string;
  levelLabel: string;
  academicStage?: AcademicStage;
  classId?: string;
  classLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
};

export type ParentChild = {
  linkId: string;
  studentId: string;
  matricule: string;
  studentName: string;
  relationship?: string;
  isPrimary: boolean;
  classId?: string;
  classLabel?: string;
  schoolYearId?: string;
  schoolYearCode?: string;
  primaryTrack?: AcademicTrack;
  primaryPlacement?: TrackPlacementSummary;
  secondaryPlacement?: TrackPlacementSummary;
  secondaryClassId?: string;
  secondaryClassLabel?: string;
  placements?: TrackPlacementSummary[];
};

export type MosqueMember = {
  id: string;
  tenantId: string;
  memberCode: string;
  fullName: string;
  sex?: "M" | "F";
  phone?: string;
  email?: string;
  address?: string;
  joinedAt?: string;
  status: "ACTIVE" | "INACTIVE";
};

export type MosqueActivity = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  activityDate: string;
  category: string;
  location?: string;
  description?: string;
  isSchoolLinked: boolean;
};

export type MosqueDonation = {
  id: string;
  tenantId: string;
  memberId?: string;
  memberCode?: string;
  memberName?: string;
  amount: number;
  currency: string;
  channel: string;
  donatedAt: string;
  referenceNo?: string;
  notes?: string;
};

export type MosqueDashboard = {
  totals: {
    members: number;
    activeMembers: number;
    activitiesThisMonth: number;
    donationsThisMonth: number;
    donationsTotal: number;
    averageDonation: number;
  };
  donationsByChannel: Array<{
    channel: string;
    count: number;
    totalAmount: number;
  }>;
};

export type MosqueExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

export type MosqueDonationReceipt = {
  receiptNo: string;
  pdfDataUrl: string;
};

export type AnalyticsTrendPoint = {
  bucket: string;
  label: string;
  value: number;
};

export type AnalyticsOverview = {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  students: {
    total: number;
    active: number;
    createdInWindow: number;
  };
  academics: {
    schoolYears: number;
    classes: number;
    subjects: number;
    activeEnrollments: number;
  };
  finance: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
    paymentsInWindow: number;
    overdueInvoices: number;
  };
  schoolLife: {
    attendanceEntries: number;
    absences: number;
    justifiedAbsences: number;
    justificationRatePercent: number;
    notificationsQueued: number;
    notificationsFailed: number;
  };
  mosque: {
    members: number;
    activeMembers: number;
    activitiesInWindow: number;
    donationsInWindow: number;
    donationsCountInWindow: number;
  };
  trends: {
    payments: AnalyticsTrendPoint[];
    donations: AnalyticsTrendPoint[];
    absences: AnalyticsTrendPoint[];
  };
};

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  username?: string;
  payloadPreview?: string;
};

export type AuditLogPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AuditLogItem[];
};

export type AuditLogExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

export type ScreenId =
  | "dashboard"
  | "iam"
  | "teachers"
  | "rooms"
  | "students"
  | "parents"
  | "messages"
  | "reference"
  | "enrollments"
  | "finance"
  | "reports"
  | "mosque"
  | "grades"
  | "schoolLifeOverview"
  | "schoolLifeAttendance"
  | "schoolLifeTimetable"
  | "schoolLifeNotifications"
  | "teacherPortal"
  | "parentPortal"
  | "studentPortal";

export type ScreenDef = {
  id: ScreenId;
  label: string;
  group: "principal" | "vie" | "portail";
  roles: Role[];
};

export type ModuleTone = "blue" | "orange" | "violet" | "green" | "teal" | "pink" | "indigo" | "slate";

export type ModuleIconName =
  | "users"
  | "messages"
  | "shield"
  | "clipboard"
  | "graduation"
  | "wallet"
  | "book"
  | "calendar"
  | "clock"
  | "bell"
  | "chart"
  | "settings"
  | "room"
  | "teacher"
  | "parent"
  | "moon";

export type ModuleTile = {
  screen: ScreenId;
  title: string;
  subtitle: string;
  icon: ModuleIconName;
  tone: ModuleTone;
  tags: string[];
};

export type HeroSlide = {
  quote: string;
  author: string;
  label: string;
};
