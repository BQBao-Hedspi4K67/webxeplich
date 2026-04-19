// ========== Application Constants ==========

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OFFICER: 'officer',
};

export const OFFICER_ROLES = {
  LEADER: 'leader',
  MANAGER: 'manager',
  OFFICER: 'officer',
};

export const DUTY_TYPES = {
  DIRECTOR_WEEKLY: 'director_weekly',
  OFFICER_DAILY: 'officer_daily',
  HOLIDAY_DAILY: 'holiday_daily',
};

export const DUTY_STATUS = {
  DONE: 'done',
  ACTIVE: 'active',
  UPCOMING: 'upcoming',
};

export const WORK_APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTO_APPROVED: 'auto_approved',
};

export const WORK_TYPES = [
  'hop',
  'hoiThao',
  'tiepkhach',
  'congtac',
  'khaoSat',
  'dienTap',
  'sinhHoat',
  'baoCao',
  'khaiGiang',
];

export const LEAVE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  ON_BUSINESS_TRIP: 'on_business_trip',
  INACTIVE: 'inactive',
  STUDYING: 'studying',
};
