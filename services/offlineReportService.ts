
import { FormData } from "../types";

export const generateOfflineReport = (formData: FormData): string => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const formatEstimatedDate = (dateVal: string) => {
    if (!dateVal) return 'לא צוין';
    const parts = dateVal.split('-');
    if (parts.length !== 3) return dateVal;
    const [year, month, day] = parts;
    return `${day}/${month}/${year.slice(-2)}`;
  };

  return `📅 *דיווח QA יומי* | ${dateStr}
-----------------------
🚀 *סטטוס:* ${formData.projectName} (${formData.version || 'ללא גרסה'})
📊 *התקדמות:* ${formData.progressPercentage}%
📅 *צפי סיום:* ${formatEstimatedDate(formData.estimatedCompletion)}

✅ *בוצע היום:*
${formData.checkedAreas}

🐞 *באגים חדשים (Jira):* ${formData.newJiraBugs}
🚫 *חוסמים:* ${formData.blockers || 'אין'}

📝 *נושאים פתוחים:*
${formData.openIssues || 'אין'}
-----------------------`;
};
