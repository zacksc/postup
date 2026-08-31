import type { Notification } from '@/types/notifications';

export const sortNotifications = (notifications: Notification[]) => {
  return [...notifications].sort((a, b) => {
    // Primeiro prioriza não lidas
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    
    // Depois prioriza as de alta prioridade
    const priorityMap = { high: 0, medium: 1, low: 2 };
    if (a.priority !== b.priority) return priorityMap[a.priority] - priorityMap[b.priority];
    
    // Por fim, cronologia
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
};