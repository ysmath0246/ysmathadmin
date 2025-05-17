import React, { useEffect, useState, useMemo, Suspense } from 'react';
import './index.css';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './components/ui/table';
import { db } from './firebase';
import { doc, collection, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import { generateScheduleWithRollovers, publicHolidaysKR } from './firebase/logic';
import StudentRow from './StudentRow';
import StudentCalendarModal from './StudentCalendarModal';
import Holidays from 'date-holidays';
import { increment } from "firebase/firestore";
 import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';  // 상단에 추가

const ADMIN_PASSWORD = '0606';

export default function App() {
  const [authorized, setAuthorized] = useState(false);
  const [inputPassword, setInputPassword] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_login");
    if (saved === "ok") setAuthorized(true);
  }, []);

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-xl font-bold mb-4">🔐 관리자 로그인</h1>
        <input
          type="password"
          placeholder="비밀번호 입력"
          value={inputPassword}
          onChange={(e) => setInputPassword(e.target.value)}
          className="border p-2 rounded mb-2"
        />
        <button
          onClick={() => {
            if (inputPassword === ADMIN_PASSWORD) {
              localStorage.setItem("admin_login", "ok");
              setAuthorized(true);
            } else {
              alert("비밀번호가 틀렸습니다.");
            }
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <AppMain />
  );
}

function AppMain() {
const hd = new Holidays('KR');
const year = new Date().getFullYear();
const publicHolidays = hd.getHolidays(year).map(h => h.date);

function findNextScheduledDate(lastDateStr, scheduledDays) {
  const dayMapping = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  let candidate = new Date(lastDateStr);
  while (true) {
    candidate.setDate(candidate.getDate() + 1);
    const dayName = Object.keys(dayMapping).find(k => dayMapping[k] === candidate.getDay());
    if (scheduledDays.includes(dayName)) break;
  }
  const yyyy = candidate.getFullYear();
  let mm = candidate.getMonth() + 1;
  let dd = candidate.getDate();
  if (mm < 10) mm = '0' + mm;
  if (dd < 10) dd = '0' + dd;
  return `${yyyy}-${mm}-${dd}`;
}


  
  // ✅ 상태 선언
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [notices, setNotices] = useState([]); // 공지사항 목록을 저장할 상태
  const [holidays, setHolidays] = useState([]);
  const [makeups, setMakeups] = useState([]);// 보강 리스트
  const [books, setBooks] = useState([]);
  const [comments, setComments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]); // ① 학부모 앱에서 선택된 결제방법 불러오기 (payment_methods 컬렉션)
  const [paymentCompleted, setPaymentCompleted] = useState([]);
  const [pointsData, setPointsData] = useState({});

  const [newStudent, setNewStudent] = useState({ name: '', birth: '', startDate: '', schedules: [{ day: '', time: '' }], parentPhone: '' });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
 // 📌 루틴 문서 가져오기 (※ 이 부분이 반드시 필요합니다)
 const [routines, setRoutines] = useState([]);


 // ─── 공지사항 관련 state ───
 const [noticeTitle, setNoticeTitle] = useState('');
 const [noticeDate, setNoticeDate] = useState('');
 const [noticeContent, setNoticeContent] = useState('');
 const [selectedNotice, setSelectedNotice] = useState(null); 
 // 공지사항 목록 상태 추가


// ─── 휴일 관련 state ───
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');

  const [commentText, setCommentText] = useState('');
  const [commentDate, setCommentDate] = useState(new Date().toISOString().slice(0,10));

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  
// 보여줄 기준 날짜
  const [viewDate, setViewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentsMonth, setPaymentsMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedPanel, setSelectedPanel] = useState('calendar');

 // 사용자 입력 휴일 목록 from Firestore
 const [holidaysInput, setHolidaysInput] = useState([]);

    const [editingHighId, setEditingHighId] = useState(null); // ✅ 이 줄을 추가하세요
 const [selectedPaymentStudent, setSelectedPaymentStudent] = useState(null);
 const [paymentRoutineNumber, setPaymentRoutineNumber] = useState('');
 const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);


const [bookTitle, setBookTitle] = useState('');
const [bookGrade, setBookGrade] = useState('');
const [bookCompletedDate, setBookCompletedDate] = useState(new Date().toISOString().split('T')[0]);

  const [selectedStudent, setSelectedStudent] = useState(null);

const pointFields = ["출석", "숙제", "수업태도", "시험", "문제집완료"];


useEffect(() => {
  const ref = collection(db, 'students');
  return onSnapshot(ref, qs => {
    const map = {};
    qs.forEach(doc => {
      const data = doc.data();
      map[doc.id] = data.points || {};
    });
    setPointsData(map);
  });
}, []);

  const [newHighStudent, setNewHighStudent] = useState({
    name: '',
    birth: '',
    parentPhone: '',
    studentPhone: '',
    weekdays: { 월: false, 화: false, 수: false, 목: false, 금: false },
    type: '월제'
  });

  // ✅ 포인트 증감 함수
const adjustPoint = async (student, field, delta) => {
  try {
    await updateDoc(
      doc(db, "students", student.id),
      {
        [`points.${field}`]: increment(delta),
        totalPoints: increment(delta),
        availablePoints: increment(delta),
      }
    );
  } catch (error) {
    console.error("포인트 저장 실패:", error);
    alert("Firestore 저장 오류");
  }
};



// ✅ 총 포인트 계산 함수
const totalPoints = (pointsObj) => {
  return pointFields.reduce((sum, key) => sum + (pointsObj?.[key] || 0), 0);
};


const [loginLogs, setLoginLogs] = useState([]);

useEffect(() => {
  const ref = collection(db, 'parentLogins');
  return onSnapshot(ref, qs => {
    const logs = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => (b.loginTime || '').localeCompare(a.loginTime || ''));
    setLoginLogs(logs);
  });
}, []);


  const handleRegisterHighStudent = async () => {
    const selectedDays = Object.entries(newHighStudent.weekdays)
      .filter(([_, checked]) => checked)
      .map(([day]) => day);

    if (!newHighStudent.name || !newHighStudent.birth || !newHighStudent.parentPhone || selectedDays.length === 0) {
      alert("모든 필수 항목을 입력하고 요일을 선택해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, 'students_high'), {
        name: newHighStudent.name,
        birth: newHighStudent.birth,
        parentPhone: newHighStudent.parentPhone,
        studentPhone: newHighStudent.studentPhone,
        days: selectedDays,
        type: newHighStudent.type,
        createdAt: new Date().toISOString()
      });

      alert("고등부 학생 등록 완료!");
      setNewHighStudent({
        name: '',
        birth: '',
        parentPhone: '',
        studentPhone: '',
        weekdays: { 월: false, 화: false, 수: false, 목: false, 금: false },
        type: '월제'
      });
    } catch (err) {
      console.error("등록 오류:", err);
      alert("등록에 실패했습니다.");
    }
  };

  // 고등부 학생 목록을 필터링하는 상태
  const [highStudents, setHighStudents] = useState([]);
  
 useEffect(() => {
  const fetchHighStudents = async () => {
    const snapshot = await getDocs(collection(db, 'students_high'));
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setHighStudents(list);
  };

  fetchHighStudents();
}, []);

const handleEditHighStudent = (s) => {
  setNewHighStudent({
    name: s.name,
    birth: s.birth,
    parentPhone: s.parentPhone,
    studentPhone: s.studentPhone,
    weekdays: ['월', '화', '수', '목', '금'].reduce((acc, d) => {
      acc[d] = (s.days || []).includes(d);
      return acc;
    }, {}),
    type: s.type || '월제'
  });
  setEditingHighId(s.id); // ✅ useState는 위에서 선언
};


  const handleDeleteHighStudent = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'students_high', id));
      setHighStudents(prev => prev.filter(s => s.id !== id));
    }
  };
 const handleSavePayment = async () => {
    if (!selectedPaymentStudent || !paymentRoutineNumber) {
      alert('루틴번호를 입력하세요.');
      return;
    }
    const ref = doc(db, 'payments_high', `${selectedPaymentStudent.id}_routine_${paymentRoutineNumber}`);
    await setDoc(ref, {
      studentId: selectedPaymentStudent.id,
      name: selectedPaymentStudent.name,
      type: selectedPaymentStudent.type,
      paidAt: paymentDate,
      routineNumber: Number(paymentRoutineNumber)
    });
    alert('결제 등록 완료');
    setSelectedPaymentStudent(null);
    setPaymentRoutineNumber('');
  };
  // ✅ Firestore 실시간 구독
  useEffect(() => {
    const ref = collection(db, 'students');
    return onSnapshot(ref, qs => setStudents(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'attendance');
    return onSnapshot(ref, qs => {
      const all = {};
      qs.forEach(doc => { all[doc.id] = doc.data(); });
      setAttendance(all);
    });
  }, []);

  useEffect(() => {
    const ref = collection(db, 'notices');
    return onSnapshot(ref, qs => setNotices(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'holidays');
    return onSnapshot(ref, qs => setHolidays(qs.docs.map(doc => ({ id: doc.id, name: doc.data().name, date: doc.data().date }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'makeups');
    return onSnapshot(ref, qs => setMakeups(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'books');
    return onSnapshot(ref, qs => setBooks(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'comments');
    return onSnapshot(ref, qs => setComments(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

 
 useEffect(() => {
  const ref = collection(db, 'payments');
  const unsub = onSnapshot(ref, qs =>
    setPaymentMethods(qs.docs.map(d => ({ id: d.id, ...d.data() })))
  , console.error);
  return () => unsub();
}, []);


  useEffect(() => {
    const ref = collection(db, 'payment_completed');
    return onSnapshot(ref, qs => setPaymentCompleted(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  
  useEffect(() => {
   const ref = collection(db, 'routines');
   const unsub = onSnapshot(ref, qs => {
     setRoutines(qs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
   });
   return () => unsub();
 }, []);


  // ✅ Memoized 계산
  const calendarWeeks = useMemo(() => {
    const [y, m] = paymentsMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const weeks = [];
    let week = Array(firstDay).fill(null);
    for (let d = 1; d <= days; d++) {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  }, [paymentsMonth]);



  const userHolidayDates = useMemo(() => holidays.map(h => h.date), [holidays]);
const [scheduleChanges, setScheduleChanges] = useState([]);
  const today = new Date().toISOString().split('T')[0]; // "2025-04-18" 형태

const enrichedStudents = useMemo(() => {
  return students.map(stu => {
    const all = scheduleChanges.filter(c => c.studentId === stu.id);
    const applicable = all.filter(c => c.effectiveDate <= today);  // 오늘 기준
    applicable.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const latest = applicable[0];
    return {
      ...stu,
      schedules: latest ? latest.schedules : stu.schedules  // 💡 스케줄 덮어쓰기
    };
  });
}, [students, scheduleChanges]);


  const sortedStudentsFull = useMemo(() => {
  if (!enrichedStudents.length || !routines.length) return [];
  const result = [];
  enrichedStudents.forEach(stu => {

      const rt = routines.find(r => r.studentId === stu.id);
      if (!rt?.lessons) return;
      rt.lessons.forEach(l => {
        if (l.session === 1) {
          if (stu.pauseDate && l.date >= stu.pauseDate) return;
          result.push({ stu, lesson: { date: l.date, routine: l.routineNumber } });
        }
      });
    });
    result.sort((a, b) => a.lesson.date.localeCompare(b.lesson.date));
    return result;
  }, [students, routines]);


  // ▶ 결제관리 탭에서 쓸 “첫회차 날짜 → 학생이름 리스트” 맵
  const paymentSessions = useMemo(() => {
    const map = {};
    sortedStudentsFull.forEach(({ stu, lesson }) => {
      if (!lesson.date.startsWith(paymentsMonth)) return;
      const key = lesson.date;  // "YYYY-MM-DD"
      if (!map[key]) map[key] = [];
      map[key].push(stu.name);
    });
    return map;
  }, [sortedStudentsFull, paymentsMonth]);



// ⇒ routines 컬렉션에서 lessons 그대로 가져와 보강·이월 반영 후 첫회차만 뽑기
  const sortedStudentsLimited = useMemo(() => {
    if (!students.length || !routines.length) return [];
    const result = [];
    students.forEach(stu => {
      // Firestore routines 에서 studentId 맞는 문서 찾기
      const rt = routines.find(r => r.studentId === stu.id);
      if (!rt?.lessons) return;

       // lessons 배열 중 session===1 인 녀석만 골라낸다
      rt.lessons.forEach(l => {
        if (l.session === 1) { // ⭐ session === 1 먼저 체크
          if (stu.pauseDate && l.date >= stu.pauseDate) return; // ⭐ pauseDate 조건은 안에
          result.push({ stu, lesson: { date: l.date, routine: l.routineNumber } });
        }
      });
    });

      // 날짜순 정렬
    result.sort((a, b) => a.lesson.date.localeCompare(b.lesson.date));

    // viewDate 기준 ±7일 범위 필터
    const center = new Date(viewDate);
    const start = new Date(center); start.setDate(center.getDate() - 7);
    const end = new Date(center); end.setDate(center.getDate() + 7);
    return result.filter(({ lesson }) => {
      const d = new Date(lesson.date);
      return d >= start && d <= end;
    });
  }, [students, routines, viewDate]);

  const calendarRoutineMap = useMemo(() => {
    const map = {};
    sortedStudentsLimited.forEach(({ stu, lesson }) => {
      const key = `${lesson.date}_${stu.name}`;
      map[key] = lesson.routine;
    });
    return map;
  }, [sortedStudentsLimited]);

 // 공지사항 추가 핸들러
  const handleAddNotice = async () => {
    try {
      await addDoc(collection(db, 'notices'), {
        title: noticeTitle,
        date: noticeDate,
        content: noticeContent,
      });
      setNoticeTitle('');
      setNoticeDate('');
      setNoticeContent('');
      alert('공지사항이 추가되었습니다!');
    } catch (e) {
      console.error('공지사항 추가 오류:', e);
    }
  };
// 공지사항  핸들러
  const handleUpdateNotice = async () => {
    try {
      await updateDoc(doc(db, 'notices', selectedNotice.id), {
        title: noticeTitle,
        date: noticeDate,
        content: noticeContent,
      });
      alert('공지사항이 수정되었습니다!');
      setSelectedNotice(null);
    } catch (e) {
      console.error('공지사항 수정 오류:', e);
    }
  };

  const handleDeleteNotice = async (id) => {
    if (window.confirm('이 공지사항을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'notices', id));
      alert('공지사항이 삭제되었습니다!');
    }
  };

  // 공지사항 수정 함수
const handleEditNotice = (notice) => {
  setSelectedNotice(notice);  // 수정하려는 공지사항을 선택
  setNoticeTitle(notice.title); // 제목을 폼에 채우기
  setNoticeDate(notice.date); // 날짜를 폼에 채우기
  setNoticeContent(notice.content); // 내용을 폼에 채우기
};


 // 휴일 추가 핸들러
  const handleAddHoliday = async () => {
    try {
      await addDoc(collection(db, 'holidays'), {
        name: holidayName,
        date: holidayDate,
      });
      setHolidayName('');
      setHolidayDate('');
      alert('휴일이 추가되었습니다!');
    } catch (e) {
      console.error('휴일 추가 오류:', e);
    }
  };
// 휴일 삭제 핸들러
  const handleDeleteHoliday = async (id) => {
    if (window.confirm('이 휴일을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'holidays', id));
    }
  };


  const handleRegister = async () => {
    try {
      const days = newStudent.schedules.map(s => s.day);
      const cnt = newStudent.schedules.length === 3 ? 12 : 8;
      const lessons = generateScheduleWithRollovers(newStudent.startDate, days, cnt);
      const data = { ...newStudent, lessons, startRoutine: newStudent.startRoutine || 1, active: true, pauseDate: null };
      let docId = '';

      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), data);
        setStudents(s => s.map(x => x.id === editingId ? { ...x, ...data } : x));
        docId = editingId;
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'students'), data);
        setStudents(s => [...s, { ...data, id: docRef.id }]);
        docId = docRef.id;
      }
 // ✅ 루틴 생성 및 Firestore 저장
      const cycleSize = days.length * 4;
      const rawLessons = generateScheduleWithRollovers(data.startDate, days, cycleSize * 10);
      const filteredLessons = rawLessons.filter(l => !data.pauseDate || l.date < data.pauseDate);
      const reindexed = [];
      let routineNumber = data.startRoutine || 1;
      let count = 1;
      let nonSkipCount = 0;

      for (let i = 0; i < filteredLessons.length; i++) {
        const l = filteredLessons[i];
        reindexed.push({ session: count, routineNumber, date: l.date, status: '미정', time: '-' });
        count++;
        nonSkipCount++;
        if (nonSkipCount === cycleSize) { routineNumber++; count = 1; nonSkipCount = 0; }
      }

      await setDoc(doc(db, 'routines', docId), {
        studentId: docId,
        name: data.name,
        lessons: reindexed,
        updatedAt: new Date().toISOString()
      });

      setNewStudent({ name: '', birth: '', startDate: '', schedules: [{ day: '', time: '' }], parentPhone: '' });
      console.log('학생 등록/수정 + 루틴 생성 완료');
    } catch (error) {
      console.error('학생 등록/수정 중 오류 발생:', error);
    }
  };

  const refreshAllData = async () => {
    const snapshot = await getDocs(collection(db, 'attendance'));
    const all = {};
    snapshot.forEach(doc => {
      all[doc.id] = doc.data();
    });
    setAttendance(all);
  
    const studentSnapshot = await getDocs(collection(db, 'students'));
    setStudents(studentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  
    const makeupSnapshot = await getDocs(collection(db, 'makeups'));
    setMakeups(makeupSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };


     // 결제관리 달력의 월을 +1/-1 변경
const changePaymentsMonth = (delta) => {
  const [year, month] = paymentsMonth.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  setPaymentsMonth(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  );
};


  
  


  const changeDate = delta => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const [y, m, day] = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    setSelectedDate(`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
  };

  const dayMap = {0:'일', 1:'월', 2:'화', 3:'수', 4:'목', 5:'금', 6:'토'};
  const selectedDay = dayMap[new Date(selectedDate).getDay()];


useEffect(() => {
  const ref = collection(db, 'schedule_changes');
  return onSnapshot(ref, qs => {
    const changes = qs.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.studentId && c.schedules && c.effectiveDate);  // ✅ 유효한 문서만
    setScheduleChanges(changes);
  });
}, []);

const getScheduleForStudentOnDate = (studentId, dateStr) => {
  const all = scheduleChanges.filter(c => c.studentId === studentId);
  const applicable = all.filter(c => c.effectiveDate <= dateStr);
  if (applicable.length === 0) return students.find(s => s.id === studentId)?.schedules || [];
  applicable.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return applicable[0].schedules;
};


const scheduledStudentsForDate = enrichedStudents.filter(s => {
  if (s.active === false) return false;
  if (s.pauseDate && selectedDate >= s.pauseDate) return false;
  const schedule = getScheduleForStudentOnDate(s.id, selectedDate);
  return schedule.some(x => x.day === selectedDay);
});




  const handlePoint = async studentId => {
    const ref = doc(db, 'points', studentId);
    const current = pointsData[studentId] || 0;
    await setDoc(ref, { points: current + 1 });
  };

  const handlePaymentComplete = async (studentId, routineNumber) => {
    const docId = `${studentId}_routine_${routineNumber}`;
    const ref = doc(db, 'payment_completed', docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      console.log('✅ 결제완료 취소됨');
    } else {
      await setDoc(ref, {
        studentId,
        routineNumber,
        paymentComplete: true,  // ✅ 필드명 일치
        updatedAt: new Date().toISOString(),
      });
      
      console.log('✅ 결제완료 저장됨');
    }
  };
  
  const downloadCSV = (rows, headers, filename) => {
    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += headers.map(h => r[h]).join(',') + '\n'; });
    saveAs(new Blob([csv], { type: 'text/csv' }), filename);
  };


  const handleExport = () => {
    let csv = '이름,출석 시간,출석 여부\n';
    scheduledStudentsForDate.forEach(s => {
      const entry = attendance[s.name];
      const time = entry && typeof entry==='object' ? entry.time : (entry||'-');
      const status = entry && typeof entry==='object' ? entry.status : (time && time!=='-' ? '출석' : '결석');
      csv += `${s.name},${time},${status}\n`;
    });
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${selectedDate}_출석현황.csv`);
  };

 
  
    const filteredStudents = useMemo(() => {
  return enrichedStudents
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [enrichedStudents, search]);

const recentRepliesInfo = useMemo(() => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const recent = comments.filter(c => {
    if (!c.comment.startsWith('답변:')) return false;
    const created = new Date(c.createdAt || c.date);
    return created >= sevenDaysAgo;
  });

  // 학생별로 중복 제거
  const uniqueNames = [...new Set(recent.map(r => r.name))];
  return uniqueNames;
}, [comments]);

  const updateSchedule = (i, k, v) => {
    const arr = [ ...newStudent.schedules ];
    arr[i][k] = v;
    setNewStudent(ns => ({ ...ns, schedules: arr }));
  };

  const addScheduleField = () =>
    setNewStudent(ns => ({ ...ns, schedules: [ ...ns.schedules, { day: '', time: '' } ] }));

  const removeScheduleField = i => {
    const arr = [ ...newStudent.schedules ]; arr.splice(i, 1);
    setNewStudent(ns => ({ ...ns, schedules: arr }));
  };

  const handleUpdateStudent = async stu => {
    await updateDoc(doc(db, 'students', stu.id), stu);
    setStudents(s => s.map(x => x.id === stu.id ? stu : x));
  };

  const handleEdit = s => {
    setNewStudent({
      name: s.name,
      birth: s.birth,
      startDate: s.startDate || '',
      startRoutine: s.startRoutine || 1,
      schedules: s.schedules || [{ day: '', time: '' }],
      parentPhone: s.parentPhone || ''
    });
    setEditingId(s.id);
  };

  const handleDelete = async id => {
    if (window.confirm('삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'students', id));
      setStudents(s => s.filter(x => x.id !== id));
    }
  };

  const handleResetPin = async (studentId) => {
    if (!window.confirm("이 학생의 PIN을 초기화하시겠습니까?")) return;
    await updateDoc(doc(db, "students", studentId), { pin: "1234" }); // 초기값 예: "1234"
    alert("PIN이 초기화되었습니다.");
  };


  
  const handleCompleteMakeup = async (id) => {
    if (window.confirm('이 보강을 완료 처리할까요?')) {
      await updateDoc(doc(db, 'makeups', id), { completed: true });
    }
  };

  const handleDeleteMakeup = async (id) => {
    if (window.confirm('정말 이 보강 기록을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'makeups', id));
    }
  };

const handleScheduleChange = async (studentId, newSchedules, effectiveDate) => {
 await addDoc(collection(db, 'schedule_changes'), {
  studentId: selectedStudent.id,  // ✅ 꼭 포함
  schedules: newStudent.schedules,
  effectiveDate: newStudent.effectiveDate,
  createdAt: new Date().toISOString()
});

  alert('수업 변경이 저장되었습니다. 루틴이 곧 반영됩니다.');
};

const [deductions, setDeductions] = useState([]);
const [deductionModalStudent, setDeductionModalStudent] = useState(null);

useEffect(() => {
  const ref = collection(db, 'deductions');
  return onSnapshot(ref, qs => {
    const list = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setDeductions(list);
  });
}, []);


// ✅ 필요한 상태
const [shopItems, setShopItems] = useState([]);
const [newShopItem, setNewShopItem] = useState({ name: '', point: '', imageUrl: '' });

// ✅ Firestore 실시간 구독
useEffect(() => {
  const ref = collection(db, 'point_shop');
  return onSnapshot(ref, qs => {
    setShopItems(qs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}, []);

// ✅ 상품 등록 핸들러
const handleAddShopItem = async () => {
  const { name, point, imageUrl } = newShopItem;
  if (!name || !point || !imageUrl) return alert("이름, 포인트, 이미지 URL을 모두 입력하세요");

  await addDoc(collection(db, 'point_shop'), {
    name,
    point: Number(point),
    imageUrl,
    createdAt: new Date().toISOString()
  });

  setNewShopItem({ name: '', point: '', imageUrl: '' });
};


// ✅ 상품 삭제
const handleDeleteShopItem = async (id) => {
  if (!window.confirm("정말 삭제하시겠습니까?")) return;

  await deleteDoc(doc(db, 'point_shop', id));
};


// ✅ 상품 수정
const handleEditShopItem = async (item) => {
  const newName = prompt("상품 이름", item.name);
  const newPoint = prompt("필요 포인트", item.point);
  const newImage = prompt("이미지 주소", item.imageUrl);
  if (!newName || !newPoint) return;
  await updateDoc(doc(db, 'point_shop', item.id), {
    name: newName,
    point: Number(newPoint),
    imageUrl: newImage
  });
};






 const logoutButton = (
    <div className="fixed top-2 right-2 z-50">
      <Button size="sm" variant="outline" onClick={() => {
        localStorage.removeItem("admin_login");
        window.location.reload();
      }}>로그아웃</Button>
    </div>
  );

  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">학원 관리자 앱</h1>
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">출석현황</TabsTrigger>
          <TabsTrigger value="students">학생관리</TabsTrigger>
          <TabsTrigger value="payments">결제관리</TabsTrigger>
          <TabsTrigger value="paid">결제완료</TabsTrigger>
          <TabsTrigger value="points">포인트관리</TabsTrigger>
          <TabsTrigger value="shop">포인트상점</TabsTrigger>
          <TabsTrigger value="notices">공지사항관리</TabsTrigger>
         <TabsTrigger value="holidays">휴일관리</TabsTrigger>
         <TabsTrigger value="makeup">보강관리</TabsTrigger>
           <TabsTrigger value="high">고등부 관리</TabsTrigger>
            <TabsTrigger value="high-payments">고등부 결제</TabsTrigger>
            <TabsTrigger value="login">로그인기록</TabsTrigger>


        </TabsList>

        {/* 출석 현황 */}
        <TabsContent value="attendance">

          {recentRepliesInfo.length > 0 && (
  <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded mb-4 font-semibold text-sm">
    🗨️ {recentRepliesInfo.join(', ')} 의 코멘트에 답변이 달렸습니다.
  </div>
)}

          <Card>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {selectedDate} ({selectedDay}요일) 출석 현황
                </h2>
                <Button size="sm" className="px-2 py-1 text-xs" onClick={handleExport}>엑셀 다운로드</Button>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Button size="sm" className="px-2 py-1 text-xs" onClick={()=>changeDate(-1)}>이전</Button>
                <Input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
                <Button size="sm" className="px-2 py-1 text-xs" onClick={()=>changeDate(1)}>다음</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>출석 시간</TableHead>
                    <TableHead>출석 여부</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
  {scheduledStudentsForDate.length > 0 ? (
    scheduledStudentsForDate.map(student => {
      const entry = attendance[selectedDate]?.[student.name];
      const timeStr = entry?.time || '-';
      const status = entry?.status || '결석';
      return (
        <TableRow key={student.id}>
          <TableCell className="whitespace-nowrap">
            <span
              className="cursor-pointer text-blue-500 hover:underline"
              onClick={() => setSelectedStudent(student)}
            >
              {student.name}
            </span>
          </TableCell>
          <TableCell>{timeStr}</TableCell>
          <TableCell>{status}</TableCell>
        </TableRow>
      );
    })
  ) : (
    <TableRow>
      <TableCell colSpan={3} className="text-center text-gray-500">
        해당 날짜에 수업이 있는 학생이 없거나 출석 정보가 없습니다.
      </TableCell>
    </TableRow>
  )}
</TableBody>

              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 학생 관리 */}
        <TabsContent value="students">
          <Card className="mb-4">
            <CardContent className="space-y-4">
              <h2 className="text-xl font-semibold">학생 등록</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="학생 이름"
                  value={newStudent.name}
                  onChange={e=>setNewStudent({...newStudent,name:e.target.value})}
                />
                <Input
                  placeholder="생년월일"
                  value={newStudent.birth}
                  onChange={e=>setNewStudent({...newStudent,birth:e.target.value})}
                />
                <Input
                  placeholder="수업 시작일 (예: 2025-04-13)"
                  value={newStudent.startDate}
                  onChange={e=>setNewStudent({...newStudent,startDate:e.target.value})}
                />

<Input
  placeholder="루틴 시작 번호 (예: 1)"
  value={newStudent.startRoutine || ''}
  onChange={e => setNewStudent({...newStudent, startRoutine: Number(e.target.value) || 1})}
/>


                <Input
                  placeholder="학부모 전화번호"
                  value={newStudent.parentPhone}
                  onChange={e=>setNewStudent({...newStudent,parentPhone:e.target.value})}
                />
                {newStudent.schedules.map((s,i)=>(
                  <div className="flex gap-2 items-center" key={i}>
                    <Input
                      placeholder="요일 (예: 월)"
                      value={s.day}
                      onChange={e=>updateSchedule(i,'day',e.target.value)}
                    />
                    <Input
                      placeholder="시간 (예: 15:00)"
                      value={s.time}
                      onChange={e=>updateSchedule(i,'time',e.target.value)}
                    />
                    <Button variant="destructive" onClick={()=>removeScheduleField(i)}>
                      삭제
                    </Button>
                  </div>
                ))}
                <Button size="sm" className="px-2 py-1 text-xs" onClick={addScheduleField} variant="outline">+ 수업 추가</Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="px-2 py-1 text-xs" onClick={handleRegister} variant="default">
                  {editingId ? '수정' : '등록'}
                </Button>
                {editingId && (
                  <Button size="sm" className="px-2 py-1 text-xs" onClick={()=>setEditingId(null)} variant="ghost">취소</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <div className="w-1/2">
              <Card>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="학생 이름 검색"
                    className="mb-4"
                    value={search}
                    onChange={e=>setSearch(e.target.value)}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>생년월일</TableHead>
                        <TableHead>전화번호</TableHead>
                        <TableHead>수업시간</TableHead>
                        <TableHead>PIN 초기화</TableHead>  {/* 추가된 헤더 */}
                        <TableHead>관리</TableHead>
                      </TableRow>
                    </TableHeader>


                    <TableBody>
      {filteredStudents.map(student => (
        <TableRow key={student.id}>
          <TableCell className="whitespace-nowrap">
 <span
  className={`cursor-pointer hover:underline ${
    student.active === false ? 'text-red-500' : 'text-blue-500'
  }`}
  onClick={() => setSelectedStudent(student)}
>
  {student.name}
</span>

</TableCell>

          <TableCell>{student.birth}</TableCell>
          <TableCell>{student.parentPhone}</TableCell>
          <TableCell>
            {student.schedules.map(s=>`${s.day}${s.time}`).join(", ")}
          </TableCell>
          <TableCell>
            <Button
  size="sm"
  className="px-2 py-1 text-xs"
  variant="outline"
  onClick={()=>handleResetPin(student.id)}
>
  초기화
</Button>

          </TableCell>
          <TableCell>
            <Button size="sm" className="px-2 py-1 text-xs" onClick={()=>handleEdit(student)}>수정</Button>
            <Button
  size="sm"
  className="px-2 py-1 text-xs"
  variant={student.active === false ? 'outline' : 'secondary'}
  onClick={async () => {
    if (student.active === false) {
      if (window.confirm(`${student.name} 학생의 휴원취소를 진행하시겠습니까?`)) {
        // 새 학생 데이터 생성
        const { id, ...rest } = student;
        const { pauseDate, active, ...newData } = rest;
        const docRef = await addDoc(collection(db, 'students'), { ...newData, active: true, pauseDate: null });
        
        alert(`${student.name} 학생이 휴원 취소되어 새 학생으로 등록되었습니다.`);

        // 기존 학생 삭제
        await deleteDoc(doc(db, 'students', student.id));
      }
    } else {
      if (window.confirm(`${student.name} 학생을 휴원 처리하시겠습니까?`)) {
        const today = new Date().toISOString().slice(0, 10);
        await updateDoc(doc(db, 'students', student.id), { active: false, pauseDate: today });
        alert(`${student.name} 학생이 휴원 처리되었습니다.`);
      }
    }
  }}
>
  {student.active === false ? '휴원취소' : '휴원'}
</Button>


            <Button size="sm" className="px-2 py-1 text-xs" variant="destructive" onClick={()=>handleDelete(student.id)}>삭제</Button>
          </TableCell>
        </TableRow>
      ))}
      {filteredStudents.length===0 && (
        <TableRow>
          <TableCell colSpan={6} className="text-center text-gray-500">
            해당 학생이 없습니다.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
 
                  </Table>
                </CardContent>
              </Card>
            </div>
            <div className="w-1/2">
  {selectedStudent ? (
    <div className="p-4 bg-white border rounded space-y-4">
      <h2 className="text-lg font-semibold mb-2">{selectedStudent.name}</h2>

      {/* 🔥 전환 버튼 */}
      <div className="flex gap-2 mb-2">
    <Button
  size="sm"
  variant={selectedPanel === 'changeSchedule' ? 'default' : 'outline'}
  onClick={() => {
    setSelectedPanel('changeSchedule');
    // ✅ 기존 student의 스케줄을 불러와 초기화!
   setNewStudent(prev => ({
  ...prev,
  schedules: enrichedStudents.find(s => s.id === selectedStudent?.id)?.schedules || [{ day: '', time: '' }]
}));

  }}
>
  수업변경
</Button>


        <Button
          size="sm"
          variant={selectedPanel === 'calendar' ? 'default' : 'outline'}
          onClick={() => setSelectedPanel('calendar')}
        >
          수업횟수
        </Button>
        <Button
          size="sm"
          variant={selectedPanel === 'books' ? 'default' : 'outline'}
          onClick={() => setSelectedPanel('books')}
        >
          책관리
        </Button>
        <Button
          size="sm"
          variant={selectedPanel === 'comments' ? 'default' : 'outline'}
          onClick={() => setSelectedPanel('comments')}
        >
          코멘트
        </Button>
      </div>

      {/* 🔥 선택된 패널에 따라 표시 */}

      {selectedPanel === 'changeSchedule' && (
  <div className="space-y-4">
    <h3 className="text-md font-semibold">현재 수업 스케줄</h3>
    {newStudent.schedules.map((s, i) => (
      <div key={i} className="flex gap-2 items-center">
        <Input
          placeholder="요일 (예: 월)"
          value={s.day}
          onChange={e => updateSchedule(i, 'day', e.target.value)}
        />
        <Input
          placeholder="시간 (예: 15:00)"
          value={s.time}
          onChange={e => updateSchedule(i, 'time', e.target.value)}
        />
        <Button size="xs" variant="destructive" onClick={() => removeScheduleField(i)}>삭제</Button>
      </div>
    ))}
    <Button size="sm" className="px-2 py-1 text-xs" onClick={addScheduleField}>+ 수업 추가</Button>

    <div className="mt-4">
      <Input
        type="date"
        value={newStudent.effectiveDate || ''}
        onChange={e => setNewStudent(ns => ({ ...ns, effectiveDate: e.target.value }))}
        placeholder="변경 시작일"
      />
    </div>

    <Button
      size="sm"
      onClick={async () => {
        if (!newStudent.effectiveDate) return alert('변경 시작일을 입력하세요!');
        if (!selectedStudent?.id) return alert('학생 선택이 필요합니다');

        await addDoc(collection(db, 'schedule_changes'), {
          studentId: selectedStudent.id,
          schedules: newStudent.schedules,
          effectiveDate: newStudent.effectiveDate,
          createdAt: new Date().toISOString(),
        });

 // 루틴 즉시 재생성 요청
 const routineNum = (selectedStudent?.startRoutine || 1);
 const studentCalendar = document.getElementById('student-calendar');
 if (studentCalendar && studentCalendar.rebuildLessons) {
   await studentCalendar.rebuildLessons(attendance, routineNum, true);
 }
 // 또는 더 확실하게 전체 리프레시
 if (typeof refreshAllData === 'function') {
   await refreshAllData();
 }
        alert('수업 변경이 저장되었습니다!');
        setNewStudent({ ...newStudent, effectiveDate: '' });
      }}
    >
      수업 변경 저장
    </Button>
  </div>
)}

      {selectedPanel === 'calendar' ? (
        <StudentCalendarModal
          student={selectedStudent}
          onUpdateStudent={handleUpdateStudent}
          onRefreshData={refreshAllData}
          inline={true}
          attendance={attendance}
          attendanceDate={selectedDate}
          holidays={[...holidays.map(h => h.date), ...publicHolidays]}
          setMakeups={setMakeups}
            scheduleChanges={scheduleChanges} 
        />
      ) : selectedPanel === 'books' ? (
        <div className="space-y-2">
          <Input
            placeholder="책 이름"
            value={bookTitle}
            onChange={e => setBookTitle(e.target.value)}
          />
          <Input
            placeholder="학년"
            value={bookGrade}
            onChange={e => setBookGrade(e.target.value)}
          />
          <Input
            type="date"
            value={bookCompletedDate}
            onChange={e => setBookCompletedDate(e.target.value)}
          />
          <Button
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={async () => {
              if (!bookTitle || !bookGrade) {
                alert('책 이름과 학년을 입력하세요!');
                return;
              }
              await addDoc(collection(db, 'books'), {
                studentId: selectedStudent.id,
                name: selectedStudent.name,
                title: bookTitle,
                grade: bookGrade,
                completedDate: bookCompletedDate,
              });
              setBookTitle('');
              setBookGrade('');
              alert('저장되었습니다!');
            }}
          >
            저장
          </Button>

          <h3 className="text-md font-semibold mt-4">저장된 책 목록</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>책 이름</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>완료일</TableHead>
                <TableHead>삭제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.filter(b => b.studentId === selectedStudent.id).map(book => (
                <TableRow key={book.id}>
                  <TableCell>{book.title}</TableCell>
                  <TableCell>{book.grade}</TableCell>
                  <TableCell>{book.completedDate}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (window.confirm('삭제하시겠습니까?')) {
                          await deleteDoc(doc(db, 'books', book.id));
                        }
                      }}
                    >
                      삭제
                    </Button>
                  </TableCell>
                  

                </TableRow>
              ))}
              {books.filter(b => b.studentId === selectedStudent.id).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    저장된 책이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
  type="date"
  value={commentDate}
  onChange={e => setCommentDate(e.target.value)}
  className="mb-2"
/>
<textarea
  placeholder="코멘트 입력"
  value={commentText}
  onChange={e => setCommentText(e.target.value)}
  rows={3}
  className="w-full border rounded p-2"
/>

          <Button
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={async () => {
              if (!commentText.trim()) {
                alert('코멘트를 입력하세요!');
                return;
              }
              await addDoc(collection(db, 'comments'), {
                studentId: selectedStudent.id,
                name: selectedStudent.name,
                comment: commentText.trim(),
                date: commentDate,  // ← 새 필드 추가
                createdAt: new Date().toISOString(),
              });
              
              setCommentText('');
              alert('저장되었습니다!');
            }}
          >
            저장
          </Button>

          <h3 className="text-md font-semibold mt-4">저장된 코멘트</h3>
<ul className="space-y-4">
  {comments
    .filter(c => c.studentId === selectedStudent.id && !c.comment.startsWith('답변:'))
    .sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt))
    .map(c => {
     const replies = comments.filter(r =>
  r.studentId === selectedStudent.id &&
  r.parentId === c.id
);

      return (
        <li key={c.id} className="border p-3 rounded shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-semibold">{c.date || c.createdAt.slice(0, 10)}</div>
              <div className="text-base mt-1 whitespace-pre-line">{c.comment}</div>
            </div>
            <Button
              size="xs"
              variant="destructive"
              onClick={async () => {
                if (window.confirm('이 코멘트를 삭제하시겠습니까?')) {
                  await deleteDoc(doc(db, 'comments', c.id));
                }
              }}
            >
              삭제
            </Button>
          </div>

          {/* 답변 목록 */}
          {replies.map(reply => (
            <div key={reply.id} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
              <div className="text-xs text-gray-500">답변 • {reply.date || reply.createdAt.slice(0, 10)}</div>
              <div className="text-sm text-gray-800">{reply.comment.replace('답변: ', '')}</div>
            </div>
          ))}

        </li>
      );
    })}

  {comments.filter(c => c.studentId === selectedStudent.id && !c.comment.startsWith('답변:')).length === 0 && (
    <li className="text-gray-500">등록된 코멘트가 없습니다.</li>
  )}
</ul>

        </div>
      )}
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded">
      <p className="text-gray-500">왼쪽 목록에서 학생을 선택하세요.</p>
    </div>
  )}
</div>


          </div>
        </TabsContent>

   
      
    {/* 결제관리 */}
<TabsContent value="payments">
  {/* 월네비게이션 */}
  <div className="flex justify-between items-center mb-4">
    <Button size="sm" className="px-2 py-1 text-xs" onClick={() => changePaymentsMonth(-1)}>◀ 이전달</Button>
    <span className="text-lg font-semibold">{paymentsMonth}월</span>
    <Button size="sm" className="px-2 py-1 text-xs" onClick={() => changePaymentsMonth(1)}>다음달 ▶</Button>
  </div>

  <table className="w-full border-collapse">
    <thead>
      <tr>
        {['일','월','화','수','목','금','토'].map(d => (
          <th key={d} className="p-2 text-center">{d}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {calendarWeeks.map((week, weekIdx) => (
        <tr key={weekIdx}>
          {week.map((day, dayIdx) => {
            const fullDateKey = day
              ? `${paymentsMonth}-${String(day).padStart(2, '0')}`
              : null;

            return (
              <td
                key={dayIdx}
                className={`border p-2 align-top h-24 ${fullDateKey === today ? 'bg-yellow-100' : ''}`}
              >
                {day && (
                  <>
                    {/* 날짜 숫자 */}
                    <div className="font-bold mb-1">{day}</div>

                    {/* 이름 + 결제상태 표시 */}
                    {(paymentSessions[fullDateKey] || []).map((name, idx) => {
                      const stu = students.find(s => s.name === name);
                      const routineNum = calendarRoutineMap[`${fullDateKey}_${name}`];
                      const isPaid = paymentCompleted.some(p => p.studentId === stu?.id && p.routineNumber === routineNum);
                      return (
                        <div key={`${name}-${idx}`}>
                          {name}{' '}
                          <span style={{ fontSize: '0.8em', color: isPaid ? 'green' : 'red' }}>
                            ({isPaid ? '결제완료' : '미결제'})
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
</TabsContent>



    
 {/* 결제관리 */}
 <TabsContent value="paid">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-semibold">결제완료 관리</h2>
    <div className="flex gap-2">
      <Button size="sm" className="px-2 py-1 text-xs" onClick={() => setViewDate(d => {
        const newDate = new Date(d);
        newDate.setDate(newDate.getDate() - 7);
        return newDate.toISOString().split('T')[0];
      })}>◀ 이전</Button>
      <span className="text-lg font-semibold">{viewDate}</span>
      <Button size="sm" className="px-2 py-1 text-xs" onClick={() => setViewDate(d => {
        const newDate = new Date(d);
        newDate.setDate(newDate.getDate() + 7);
        return newDate.toISOString().split('T')[0];
      })}>다음 ▶</Button>
    </div>
  </div>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>이름</TableHead>
        <TableHead>루틴</TableHead>
        <TableHead>수업시작일</TableHead>
        <TableHead>결제방법</TableHead>
        <TableHead>결제완료</TableHead>
        <TableHead>결제알림</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
    {sortedStudentsLimited.map(({ stu, lesson }, i) => {
  const isCompleted = paymentCompleted.some(p => 
    p.studentId === stu.id && p.routineNumber === lesson.routine
  );

  return (
    <TableRow key={stu.id + '-' + i}>
      <TableCell>{stu.name}</TableCell>
      <TableCell>{lesson.routine}</TableCell>
      <TableCell>{lesson.date}</TableCell>
      <TableCell>
        {
          paymentMethods.find(p => 
            p.studentId === stu.id && 
            p.routineNumber === lesson.routine
          )?.paymentMethod || '-'
        }
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          className={`px-2 py-1 text-xs ${
            isCompleted
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          onClick={() => handlePaymentComplete(stu.id, lesson.routine)}
        >
          {isCompleted ? '완료됨' : '결제완료'}
        </Button>
      </TableCell>
      <TableCell>
        <Button variant="outline" disabled>추가기능 예정</Button>
      </TableCell>
    </TableRow>
  );
})}

      {sortedStudentsLimited.length === 0 && (
        <TableRow>
          <TableCell colSpan={6} className="text-center text-gray-500">
            해당 기간에 시작하는 수업이 없습니다.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
</TabsContent>





        {/* 포인트관리 */}
       <TabsContent value="points">
        
  <Card>
    <CardContent className="space-y-4">
      <h2 className="text-xl font-semibold">포인트 관리</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            {pointFields.map(field => (
              <TableHead key={field}>{field}</TableHead>
            ))}
            <TableHead>총합 / 가용</TableHead>
          </TableRow>
        </TableHeader>
       <TableBody>
  {[...students].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
    <TableRow key={s.id}>
      <TableCell>{s.name}</TableCell>
      {pointFields.map(field => (
        <TableCell key={field}>
          <div className="flex items-center gap-2">
            <span>{pointsData[s.id]?.[field] || 0}</span>
            <Button size="xs" onClick={() => adjustPoint(s, field, +1)}>+1</Button>
            <Button size="xs" variant="destructive" onClick={() => adjustPoint(s, field, -1)}>-1</Button>
          </div>
        </TableCell>
      ))}
       <TableCell className="font-bold">
  총 {totalPoints(pointsData[s.id]) || 0}점<br />
  <span className="text-sm text-blue-600">가용 {s.availablePoints || 0}점</span><br />
  <Button
    size="xs"
    variant="outline"
    className="mt-1"
    onClick={() => setDeductionModalStudent(s)}
  >
    차감내역
  </Button>
</TableCell>

    </TableRow>
  ))}
</TableBody>

      </Table>
    </CardContent>
  </Card>

  {deductionModalStudent && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded p-6 w-[400px] max-h-[70vh] overflow-auto">
      <h2 className="text-lg font-bold mb-4">
        {deductionModalStudent.name}님의 차감내역
      </h2>

      <ul className="space-y-2">
        {deductions.filter(d => d.studentId === deductionModalStudent.id).length > 0 ? (
          deductions
            .filter(d => d.studentId === deductionModalStudent.id)
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map(d => (
             <li key={d.id} className="border p-2 rounded relative">
  <div className="text-sm font-semibold">🛍 {d.item}</div>
  <div className="text-sm">포인트: -{d.pointsUsed}점</div>
  <div className="text-xs text-gray-500">{d.date}</div>

  <Button
    size="xs"
    variant="destructive"
    className="absolute top-2 right-2"
    onClick={async () => {
      if (window.confirm("이 차감내역을 정말 취소하시겠습니까?")) {
        try {
          // 1. 차감 문서 삭제
          await deleteDoc(doc(db, "deductions", d.id));

          // 2. 가용 포인트 복원
          await updateDoc(doc(db, "students", deductionModalStudent.id), {
            availablePoints: increment(d.pointsUsed)
          });

          alert("차감이 취소되었고, 포인트가 복구되었습니다.");
        } catch (err) {
          console.error(err);
          alert("차감 취소에 실패했습니다.");
        }
      }
    }}
  >
    ❌ 취소
  </Button>
</li>

            ))
        ) : (
          <li className="text-gray-500">차감 내역이 없습니다.</li>
        )}
      </ul>

      <div className="text-right mt-4">
        <Button variant="outline" size="sm" onClick={() => setDeductionModalStudent(null)}>
          닫기
        </Button>
      </div>
    </div>
  </div>
)}

</TabsContent>


<TabsContent value="shop">
  <Card>
    <CardContent className="space-y-4">
      <h2 className="text-xl font-semibold">🛍 포인트 상점</h2>
      <div className="flex gap-2 items-center">
        <Input
          placeholder="상품명"
          value={newShopItem.name}
          onChange={e => setNewShopItem({ ...newShopItem, name: e.target.value })}
        />
        <Input
          placeholder="필요 포인트"
          type="number"
          value={newShopItem.point}
          onChange={e => setNewShopItem({ ...newShopItem, point: e.target.value })}
        />
      <Input
  placeholder="이미지 URL (예: https://firebasestorage.googleapis.com/...)"
  value={newShopItem.imageUrl}
  onChange={e => setNewShopItem({ ...newShopItem, imageUrl: e.target.value })}
/>



        <Button onClick={handleAddShopItem}>상품 등록</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="border p-3 rounded shadow-sm">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="w-full h-40 object-cover rounded mb-2" />
            )}
            <div className="text-lg font-bold">{item.name}</div>
            <div className="text-sm text-gray-600">필요 포인트: {item.point}</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => handleEditShopItem(item)}>수정</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteShopItem(item.id)}>삭제</Button>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>


       <TabsContent value="notices">
  <Card>
    <CardContent className="space-y-4">
      <h2 className="text-xl font-semibold">공지사항 추가</h2>
      <div className="flex flex-col gap-4">
        <Input
          placeholder="공지사항 제목"
          value={noticeTitle}
          onChange={(e) => setNoticeTitle(e.target.value)}
        />
        <Input
          placeholder="공지사항 날짜"
          value={noticeDate}
          onChange={(e) => setNoticeDate(e.target.value)}
        />
        <textarea
        placeholder="공지사항 내용"
         value={noticeContent}
         onChange={(e) => setNoticeContent(e.target.value)}
         rows={10}                      // 원하는 높이에 맞춰 조정
         className="w-full h-32         // 가로는 100%, 세로 고정 높이
           border rounded p-2           // 테두리, 둥근 모서리, 안쪽 여백
           resize-y"                    // 세로 방향으로만 크기 조절 가능
       />
        <Button size="sm" className="px-2 py-1 text-xs" onClick={selectedNotice ? handleUpdateNotice : handleAddNotice}>
          {selectedNotice ? '수정하기' : '공지사항 추가'}
        </Button>
      </div>

      {/* 공지사항 목록 표시 */}
      <h2 className="text-xl font-semibold mt-4">공지사항 목록</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>제목</TableHead>
            <TableHead>날짜</TableHead>
            <TableHead>수정</TableHead>
            <TableHead>삭제</TableHead>  
          </TableRow>
        </TableHeader>
        <TableBody>
          {notices.map(notice => (
              <TableRow key={notice.id}>
                <TableCell>{notice.title}</TableCell>
                <TableCell>{notice.date}</TableCell>
                <TableCell>
                  <Button size="sm" className="px-2 py-1 text-xs" onClick={() => handleEditNotice(notice)}>
                    수정
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteNotice(notice.id)}
                  >
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {notices.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500">
                  등록된 공지사항이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </TabsContent>


<TabsContent value="holidays">
<Card className="mb-4">
    <CardContent className="space-y-4">
      <h2 className="text-xl font-semibold">휴일 추가</h2>
      <div className="flex gap-2">
        <Input
          placeholder="휴일 이름"
          value={holidayName}
          onChange={e => setHolidayName(e.target.value)}
        />
        <Input
          placeholder="YYYY-MM-DD"
          type="date"
          value={holidayDate}
          onChange={e => setHolidayDate(e.target.value)}
        />
        <Button size="sm" className="px-2 py-1 text-xs" onClick={handleAddHoliday}>추가</Button>
      </div>
    </CardContent>
  </Card>
  {/* ■ 추가된 휴일 목록 */}
  <Card>
    <CardContent>
      <h2 className="text-xl font-semibold mb-2">등록된 휴일</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>날짜</TableHead>
            <TableHead>삭제</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays.map(h => (
            <TableRow key={h.id}>
              <TableCell>{h.name}</TableCell>
              <TableCell>{h.date}</TableCell>
              <TableCell>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteHoliday(h.id)}>
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {holidays.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-gray-500">
                등록된 휴일이 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</TabsContent>


<TabsContent value="makeup">
  <Card>
    <CardContent className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">보강관리</h2>

      {/* 미완료 보강 */}
      {makeups.filter(m => !m.completed).length === 0 ? (
        <div className="text-gray-500">현재 등록된 보강이 없습니다.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>원래 수업일</TableHead> {/* 추가 */}
              <TableHead>보강/클리닉 선택</TableHead>
              <TableHead>보강 날짜</TableHead>
              <TableHead>완료</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {makeups.filter(m => !m.completed).map((m, idx) => (
              <TableRow key={idx}>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.sourceDate}</TableCell> {/* 추가 */}
                <TableCell>
                  <select
                    value={m.type}
                    onChange={e => {
                      const updated = [...makeups];
                      updated[idx].type = e.target.value;
                      setMakeups(updated);
                    }}
                  >
                    <option value="보강">보강</option>
                    <option value="클리닉">클리닉</option>
                  </select>
                </TableCell>

                
                <TableCell>
        <Input
          type="date"
          value={m.date}
          onChange={async (e) => {
            const newDate = e.target.value;
            const updated = [...makeups];
            updated[idx].date = newDate;
            setMakeups(updated);

            // ⭐ Firestore에도 즉시 저장
            await updateDoc(doc(db, 'makeups', m.id), { date: newDate });
          }}
        />
      </TableCell>
                <TableCell>
                  <Button size="sm" className="px-2 py-1 text-xs" onClick={() => handleCompleteMakeup(m.id)} variant="destructive">
                    가능
                  </Button>
                  <Button size="sm" className="px-2 py-1 text-xs" onClick={() => handleDeleteMakeup(m.id)} variant="destructive">
    삭제
  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 완료된 보강 목록 */}
      <h3 className="text-lg font-semibold mt-8">완료된 보강</h3>
      {makeups.filter(m => m.completed).length === 0 ? (
        <div className="text-gray-400">완료된 보강이 없습니다.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>원래 수업일</TableHead> {/* 추가 */}
              <TableHead>보강/클리닉</TableHead>
              <TableHead>보강 날짜</TableHead>
              <TableHead>삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {makeups
  .filter(m => m.completed)
  .sort((a, b) => b.date.localeCompare(a.date)) // ✅ 최신순으로 정렬 (최신 위, 과거 아래)
  .map((m, idx) => (
    <TableRow key={idx}>
      <TableCell>{m.name}</TableCell>
      <TableCell>{m.sourceDate}</TableCell>
      <TableCell>{m.type}</TableCell>
      <TableCell>{m.date}</TableCell>
      <TableCell>
        <Button
          onClick={async () => {
            if (window.confirm('이 보강을 다시 보강관리로 되돌릴까요?')) {
              await updateDoc(doc(db, 'makeups', m.id), { completed: false });
            }
          }}
          variant="default"
        >
          되돌리기
        </Button>
        <Button
          onClick={async () => {
            if (window.confirm('이 보강을 보강완료로 처리할까요?')) {
              await updateDoc(doc(db, 'makeups', m.id), { status: '보강완료' });
              alert('보강완료로 변경되었습니다!');
            }
          }}
          style={{
            backgroundColor: m.status === '보강완료' ? 'gray' : '',
            color: m.status === '보강완료' ? 'white' : '',
            borderColor: m.status === '보강완료' ? 'gray' : '',
          }}
          variant="outline"
        >
          보강완료
        </Button>
      </TableCell>
    </TableRow>
))}

          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
</TabsContent>
   {/* 고등부 관리 탭 */}
        <TabsContent value="high">
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">고등부 학생 등록</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input placeholder="이름" value={newHighStudent.name} onChange={e => setNewHighStudent({ ...newHighStudent, name: e.target.value })} />
          <Input placeholder="생년월일" value={newHighStudent.birth} onChange={e => setNewHighStudent({ ...newHighStudent, birth: e.target.value })} />
          <Input placeholder="학부모 전화번호" value={newHighStudent.parentPhone} onChange={e => setNewHighStudent({ ...newHighStudent, parentPhone: e.target.value })} />
          <Input placeholder="학생 전화번호" value={newHighStudent.studentPhone} onChange={e => setNewHighStudent({ ...newHighStudent, studentPhone: e.target.value })} />
        </div>
        <div>
          <label className="block font-semibold mt-4 mb-2">운영 방식</label>
          <select
            value={newHighStudent.type}
            onChange={e => setNewHighStudent({ ...newHighStudent, type: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="월제">월제</option>
            <option value="횟수제">횟수제</option>
          </select>
        </div>
        <div className="mt-4">
          <label className="block font-semibold mb-2">수업 요일</label>
          <div className="flex gap-4">
            {['월', '화', '수', '목', '금'].map(day => (
              <label key={day} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={newHighStudent.weekdays[day]}
                  onChange={e =>
                    setNewHighStudent(prev => ({
                      ...prev,
                      weekdays: { ...prev.weekdays, [day]: e.target.checked }
                    }))
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="mt-4" onClick={handleRegisterHighStudent}>{editingHighId ? '수정' : '등록'}</Button>
          {editingHighId && <Button size="sm" className="mt-4" variant="ghost" onClick={() => setEditingHighId(null)}>취소</Button>}
        </div>

        {/* ✅ 고등부 학생 목록 표시 */}
        <h3 className="text-xl font-semibold mt-10">고등부 학생 목록</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>생년월일</TableHead>
              <TableHead>학부모 번호</TableHead>
              <TableHead>학생 번호</TableHead>
              <TableHead>요일</TableHead>
              <TableHead>운영방식</TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {highStudents.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.birth}</TableCell>
                <TableCell>{s.parentPhone}</TableCell>
                <TableCell>{s.studentPhone}</TableCell>
                <TableCell>{(s.days || []).join(', ')}</TableCell>
                <TableCell>{s.type}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditHighStudent(s)}>수정</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteHighStudent(s.id)}>삭제</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {highStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">등록된 고등부 학생이 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TabsContent>


          <TabsContent value="high-payments">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">고등부 결제 관리</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>운영방식</TableHead>
                <TableHead>결제 등록</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highStudents.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.type}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => setSelectedPaymentStudent(s)}>결제 입력</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {selectedPaymentStudent && (
            <Card className="mt-6">
              <CardContent className="space-y-4">
                <h4 className="text-lg font-semibold">{selectedPaymentStudent.name} 결제 입력</h4>
                <Input
                  placeholder="루틴 번호 (예: 1)"
                  value={paymentRoutineNumber}
                  onChange={e => setPaymentRoutineNumber(e.target.value)}
                />
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePayment}>저장</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedPaymentStudent(null)}>취소</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
<TabsContent value="login">
  <Card>
    <CardContent>
      <h2 className="text-xl font-semibold mb-4">학부모 로그인 기록</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>학생 이름</TableHead>
            <TableHead>로그인 시간</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loginLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-gray-500">
                로그인 기록이 없습니다.
              </TableCell>
            </TableRow>
          
          ) : (
            loginLogs.map(log => (
              <TableRow key={log.id}>
                <TableCell>{log.studentName}</TableCell>
                <TableCell>{log.loginTime?.replace("T", " ").slice(0, 19)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</TabsContent>

      </Tabs>

     

    </div>
  );
}
