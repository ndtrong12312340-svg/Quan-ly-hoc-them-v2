import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const fetchClassDataDirectly = async (className: string) => {
  if (!className) return { exams: [], knowledges: [], essays: [] };
  className = className.trim();
  try {
    let block = className.match(/^(\d+)/)?.[1] || '';
    const classQ = query(collection(db, 'classes'), where('name', '==', className));
    const classDocs = await getDocs(classQ);
    if (!classDocs.empty) {
      block = classDocs.docs[0].data().block || block;
    }

    const qExams = query(
      collection(db, 'exams'),
      where('status', '==', 'published'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => {
      const data = doc.data();
      delete data.questions;
      return { id: doc.id, ...data };
    });

    const qEssays = collection(db, 'essays');
    const essaySnap = await getDocs(qEssays);
    const essaysList = essaySnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((essay: any) => {
        const normalizedClassName = className.trim().toLowerCase().replace(/\s+/g, '');
        return essay.assignedClasses?.some((c: string) => 
          c.trim().toLowerCase().replace(/\s+/g, '') === normalizedClassName
        );
      });

    const qKnowledges = collection(db, 'knowledges');
    const knowledgeSnap = await getDocs(qKnowledges);
    const knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredKnowledges = knowledgesList.filter((k: any) => {
      const kClass = (k.className || '').trim().toLowerCase();
      const sClass = (className || '').trim().toLowerCase();
      const matchClass = !kClass || kClass === sClass;
      const matchBlock = !k.block || String(k.block).trim() === String(block).trim();

      if (kClass) return matchClass;
      return matchBlock;
    });

    return {
      exams: examsList,
      knowledges: filteredKnowledges,
      essays: essaysList
    };
  } catch (error) {
    console.error("Error fetching class data directly:", error);
    return { exams: [], knowledges: [], essays: [] };
  }
};

export const syncClassSummary = async (className: string) => {
  if (!className) return;
  className = className.trim();
  
  try {
    // 1. Fetch exams for this class
    const qExams = query(
      collection(db, 'exams'),
      where('status', '==', 'published'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => {
      const data = doc.data();
      delete data.questions; // Ensure payload stays small
      return { id: doc.id, ...data };
    });

    // 1.5 Fetch essays for this class
    const qEssays = collection(db, 'essays');
    const essaySnap = await getDocs(qEssays);
    const essaysList = essaySnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((essay: any) => {
        const normalizedClassName = className.trim().toLowerCase().replace(/\s+/g, '');
        return essay.assignedClasses?.some((c: string) => 
          c.trim().toLowerCase().replace(/\s+/g, '') === normalizedClassName
        );
      });

    // 2. Fetch knowledge for this class
    let block = className.match(/^(\d+)/)?.[1] || '';
    const classQ = query(collection(db, 'classes'), where('name', '==', className));
    const classDocs = await getDocs(classQ);
    if (!classDocs.empty) {
      block = classDocs.docs[0].data().block || block;
    }

    const qKnowledges = collection(db, 'knowledges');
    const knowledgeSnap = await getDocs(qKnowledges);
    const knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredKnowledges = knowledgesList.filter((k: any) => {
      const kClass = (k.className || '').trim().toLowerCase();
      const sClass = (className || '').trim().toLowerCase();
      const matchClass = !kClass || kClass === sClass;
      const matchBlock = !k.block || String(k.block).trim() === String(block).trim();

      if (kClass) return matchClass;
      return matchBlock;
    });
    
    // Write to document
    const summaryRef = doc(db, 'class_summaries', className);
    await setDoc(summaryRef, {
      className,
      exams: examsList,
      knowledges: filteredKnowledges,
      essays: essaysList,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`Synced class_summaries for ${className} successfully`);
  } catch (error) {
    console.error("Error syncing class_summary:", error);
  }
};
