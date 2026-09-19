export interface GanttError {
  code: string;
  message: string;
}

export const GANTT_ERRORS = {
  ERR_001: {
    code: 'ERR-001',
    message: 'Project actual start date cannot be earlier than the minimum actual start date of all its tasks.'
  },
  ERR_002: {
    code: 'ERR-002',
    message: 'Project actual end date cannot be later than the maximum actual end date of all its tasks.'
  },
  ERR_003: {
    code: 'ERR-003',
    message: 'Task actual start date cannot be earlier than the minimum actual start date of all its subtasks.'
  },
  ERR_004: {
    code: 'ERR-004',
    message: 'Task actual end date cannot be later than the maximum actual end date of all its subtasks.'
  },
  ERR_005: {
    code: 'ERR-005',
    message: 'Task planned cost must equal the sum of all its subtasks\' planned costs.'
  },
  ERR_006: {
    code: 'ERR-006',
    message: 'Project planned budget must equal the sum of all its tasks\' planned costs.'
  },
  ERR_007: {
    code: 'ERR-007',
    message: 'Task progress must equal the average progress of all its subtasks.'
  },
  ERR_008: {
    code: 'ERR-008',
    message: 'Project progress must equal the average progress of all its tasks.'
  },
  ERR_011: {
    code: 'ERR-011',
    message: 'Task/subtask cannot be started until its predecessor task/subtask is in Completed status.'
  }
};
