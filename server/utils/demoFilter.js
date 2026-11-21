export const DEMO_USER_IDS = ['demo_student', 'demo_teacher'];

export const isDemoUserId = (userId) =>
  typeof userId === 'string' && DEMO_USER_IDS.includes(userId);

export const isDemoReq = (req) =>
  isDemoUserId(req?.user?.userId);

export const NON_DEMO_USER_FILTER = {
  userId: { $nin: DEMO_USER_IDS },
  email: { $not: /@quizplatform\.demo$/i }
};

export const NON_DEMO_CLAN_FILTER = {
  tag: { $ne: 'DEMO' },
  name: { $ne: 'Live Demo Cohort' },
  leaderId: { $nin: DEMO_USER_IDS }
};

export const isDemoClanDoc = (clan) => {
  if (!clan) return false;
  return (
    clan.tag === 'DEMO' ||
    clan.name === 'Live Demo Cohort' ||
    isDemoUserId(clan.leaderId)
  );
};
