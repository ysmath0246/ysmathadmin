import React, { useEffect, useState, useMemo, Suspense } from 'react';
import ReactQuill from 'react-quill';   
import 'react-quill/dist/quill.snow.css';   // ← 여기에 먼저!
import './index.css';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './components/ui/table';
import { db } from './firebase';
import { doc, collection, addDoc, deleteDoc, updateDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import { generateScheduleWithRollovers, publicHolidaysKR } from './firebase/logic';
import StudentRow from './StudentRow';
import StudentCalendarModal from './StudentCalendarModal';
import Holidays from 'date-holidays';
import { increment } from "firebase/firestore";
 import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';  // 상단에 추가
import { setDoc } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';


 // ─── 공지사항 HTML → 텍스트 변환 유틸 함수 ───
// HTML 태그를 제거하되, <p>, <br>은 줄바꿈으로 변환
const convertText = html =>
  html
    .replace(/<p>/g, '\n')
    .replace(/<\/p>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

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
  const [books, setBooks] = useState([]);
  const [comments, setComments] = useState([]);
  const [answers, setAnswers] = useState([]);

  const [paymentMethods, setPaymentMethods] = useState([]); // ① 학부모 앱에서 선택된 결제방법 불러오기 (payment_methods 컬렉션)
  const [paymentCompleted, setPaymentCompleted] = useState([]);
  const [pointsData, setPointsData] = useState({});

  const [newStudent, setNewStudent] = useState({ name: '', birth: '', startDate: '', schedules: [{ day: '', time: '' }], parentPhone: '' });

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
 // 📌 루틴 문서 가져오기 (※ 이 부분이 반드시 필요합니다)
 const [routines, setRoutines] = useState([]);
const [searchName, setSearchName] = useState('')        // 검색어
const [page, setPage] = useState(0)                      // 현재 페이지 인덱스 (0부터)
const itemsPerPage = 10            

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
// ─── 고등부 수업현황 관련 state ───
const [selectedHighStudent, setSelectedHighStudent] = useState(null);
const [highAttendanceDates, setHighAttendanceDates] = useState([]);
const [newHighDate, setNewHighDate] = useState(() => new Date().toISOString().slice(0,10));       // YYYY-MM-DD
const [highMonth, setHighMonth] = useState(() => new Date().toISOString().slice(0,7));            // YYYY-MM
const [sessionPageIndex, setSessionPageIndex] = useState(0);

 // 학생 목록 페이지네이션
 const [studentPage, setStudentPage] = useState(1);
 const studentsPerPage = 8;

useEffect(() => {
  const unsub = onSnapshot(
    collection(db, 'high-attendance'),
    qs => {
      const arr = qs.docs
        .map(d => ({ id: d.id, data: d.data() }))
        .sort((a, b) => a.id.localeCompare(b.id));
       setHighAttendanceDates(arr);
      setHighAttendanceDates(arr);
    }
  );
  return () => unsub();
}, []);


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

// ✅ 가용포인트 증감 함수
const adjustAvailable = async (student, delta) => {
  try {
    await updateDoc(
      doc(db, "students", student.id),
      { availablePoints: increment(delta) }
    );
  } catch (error) {
    console.error("가용포인트 저장 실패:", error);
    alert("가용포인트 저장 오류");
  }
};
const paidList = useMemo(() => {
  return routines
    .map(r => {
      const std = Object.values(r.students||{})[0]
      const s1  = std?.sessions?.['1']
      if (!s1) return null
      return { studentId: std.studentId, name: std.name, date: s1.date, routineNumber: s1.routineNumber }
    })
    .filter(x => x)                              // null 제거
    .filter(x => !searchName || x.name.includes(searchName))
     .sort((a, b) => new Date(b.date) - new Date(a.date))
}, [routines, searchName])

const pageCount = Math.ceil(paidList.length / itemsPerPage)
const paged     = paidList.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage)

  // ─── 0) 이미 완료된 결제 레코드 로드 ───
  const [completedMap, setCompletedMap] = useState({})
   const [paymentsData, setPaymentsData] = useState([])
 useEffect(() => {
   (async () => {
     const snap = await getDocs(collection(db, 'payments'))
     setPaymentsData(snap.docs.map(d => d.data()))
   })()
 }, [])
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'payment_completed'))
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setCompletedMap(map)
    })()
  }, [])

// ✅ 총 포인트 계산 함수
const totalPoints = (pointsObj) => {
  return pointFields.reduce((sum, key) => sum + (pointsObj?.[key] || 0), 0);
};


const [loginLogs, setLoginLogs] = useState([]);
 const [currentPage, setCurrentPage] = useState(1);        // ← 현재 페이지
 const logsPerPage = 20;                                    // ← 페이지당 20개씩
 // 로그인 기록 삭제 핸들러
 const handleDeleteLog = async (id) => {
   if (!window.confirm('이 로그인 기록을 삭제하시겠습니까?')) return;
   await deleteDoc(doc(db, 'parentLogins', id));
   // 삭제 후, 페이지가 비어 있으면 한 페이지 뒤로
   if ((currentPage - 1) * logsPerPage >= loginLogs.length - 1) {
     setCurrentPage(prev => Math.max(prev - 1, 1));
   }
 };
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
return onSnapshot(ref, qs => {
    const hols = qs.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      date: doc.data().date
    }));
    // date 문자열('YYYY-MM-DD') 기준으로 내림차순 정렬
    hols.sort((a, b) => b.date.localeCompare(a.date));
    setHolidays(hols);
  });  }, []);

 

  useEffect(() => {
    const ref = collection(db, 'books');
    return onSnapshot(ref, qs => setBooks(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  useEffect(() => {
    const ref = collection(db, 'comments');
    return onSnapshot(ref, qs => setComments(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, []);

  // answer 구독 추가
  useEffect(() => {
    const ref = collection(db, 'answer');
    return onSnapshot(ref, qs => setAnswers(qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
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
  // 사용자 휴일 + KR 공휴일(YYYY-MM-DD) 합치기
  const allHolidaySet = useMemo(() => {
    const s = new Set(userHolidayDates);
    (publicHolidays || []).forEach(d => s.add(String(d).slice(0,10)));
    return s;
  }, [userHolidayDates]);

const today = new Date().toISOString().split('T')[0]; // "2025-04-18" 형태

const enrichedStudents = students;


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

  const center = new Date(viewDate);
  const start = new Date(center); start.setDate(center.getDate() - 7);
  const end = new Date(center); end.setDate(center.getDate() + 7);
  return result.filter(({ lesson }) => {
    const d = new Date(lesson.date);
    return d >= start && d <= end;
  });
}, [enrichedStudents, routines, viewDate]);

  const calendarRoutineMap = useMemo(() => {
    const map = {};
    sortedStudentsLimited.forEach(({ stu, lesson }) => {
      const key = `${lesson.date}_${stu.name}`;
      map[key] = lesson.routine;
    });
    return map;
  }, [sortedStudentsLimited]);


const handleAddHighDate = async () => {
  if (!selectedHighStudent) return alert('학생을 선택하세요.');
  const dateRef = doc(db, 'high-attendance', newHighDate);
  const attendanceRecord = {
    status: '출석',
    time: new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit'
    })
  };
  try {
    // 이미 있는 문서면 필드만 덮어쓰기
    await updateDoc(dateRef, {
      [selectedHighStudent.name]: attendanceRecord
    });
  } catch {
    // 문서가 없으면 새로 만들기
    await setDoc(dateRef, {
      [selectedHighStudent.name]: attendanceRecord
    });
  }
};

const handleDeleteHighDate = async (dateId) => {
  if (!selectedHighStudent) return;
  const dateRef = doc(db, 'high-attendance', dateId);
  await updateDoc(dateRef, {
    [selectedHighStudent.name]: deleteField()
  });
};


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
        // 수정 후 폼도 초기화
   setNoticeTitle('');
   setNoticeDate('');
   setNoticeContent('');
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

 // ✅ 1) 책 수정 핸들러
  const handleEditBook = async (book) => {
    const newTitle = prompt("책 제목", book.title);
    const newGrade = prompt("학년", book.grade);
    const newDate = prompt("완료일 (YYYY-MM-DD)", book.completedDate);
   if (!newTitle || !newGrade || !newDate) return;
    await updateDoc(doc(db, 'books', book.id), {
      title: newTitle,
      grade: newGrade,
      completedDate: newDate
    });
    alert("책 정보가 수정되었습니다.");
  };
  const handleRegister = async () => {
    try {
      const days = newStudent.schedules.map(s => s.day);
      const cnt = newStudent.schedules.length === 3 ? 12 : 8;
    //  const lessons = generateScheduleWithRollovers(newStudent.startDate, days, cnt);
      //const data = { ...newStudent, lessons, startRoutine: newStudent.startRoutine || 1, active: true, pauseDate: null };
       // 더 이상 students 컬렉션에는 lessons 저장 안 함
 const data = { 
   ...newStudent, 
   startRoutine: newStudent.startRoutine || 1,
   active: true, 
   pauseDate: null 
 };
      
      
      let docId = '';

        if (editingId) {
  const studentRef = doc(db, 'students', editingId);
  await updateDoc(studentRef, data);


        // 기존 data(=newStudent 기반)를 그대로 사용하여 업데이트
        setStudents(s => s.map(x => x.id === editingId ? { ...x, ...data } : x));
        docId = editingId;
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'students'), data);
        setStudents(s => [...s, { ...data, id: docRef.id }]);
        docId = docRef.id;
      }
 

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



const getScheduleForStudentOnDate = (studentId) => {
  return students.find(s => s.id === studentId)?.schedules || [];
};


const scheduledStudentsForDate = enrichedStudents.filter(s => {
  if (s.active === false) return false;
  if (s.pauseDate && selectedDate >= s.pauseDate) return false;
const schedule = getScheduleForStudentOnDate(s.id);

return schedule.some(x => x.day === selectedDay);
});




  const handlePoint = async studentId => {
    const ref = doc(db, 'points', studentId);
    const current = pointsData[studentId] || 0;
    await setDoc(ref, { points: current + 1 });
  };
// App.jsx import에 deleteDoc,getDoc,setDoc 추가 확인:
// import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const handlePaymentComplete = async (studentId, routineNumber, studentName) => {
  const docId = `${studentName}_${routineNumber}`;
  const ref   = doc(db, 'payment_completed', docId);
  const snap  = await getDoc(ref);

  if (snap.exists()) {
    // 취소
    await deleteDoc(ref);
    console.log('✅ 결제완료 취소됨');
  } else {
    // 저장
    await setDoc(ref, {
      studentId,
      routineNumber,
      paymentComplete: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log('✅ 결제완료 저장됨');
  }

  // UI 즉시 반영
  setCompletedMap(cm => {
    const m = { ...cm };
    if (m[docId]) delete m[docId];
    else m[docId] = { studentId, routineNumber, paymentComplete: true };
    return m;
  });
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
 // ─── 페이지네이션된 학생 목록 계산 ───
 const totalStudentPages = Math.ceil(filteredStudents.length / studentsPerPage);
 const paginatedStudents = filteredStudents.slice(
   (studentPage - 1) * studentsPerPage,
   studentPage * studentsPerPage
 );
const recentRepliesInfo = useMemo(() => {
   const now = new Date();
   const sevenDaysAgo = new Date(now);
   sevenDaysAgo.setDate(now.getDate() - 7);

   // answer 컬렉션에서 7일 이내의 답변만 필터
   const recent = answers.filter(a => {
     const created = new Date(a.createdAt || a.date);
     return created >= sevenDaysAgo;
   });

   // 학생 이름 중복 제거
   const uniqueNames = [...new Set(recent.map(r => r.studentName || r.name))];
   return uniqueNames;
 }, [answers]);
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

 // const handleUpdateStudent = async stu => {
  //  await updateDoc(doc(db, 'students', stu.id), stu);
  //  setStudents(s => s.map(x => x.id === stu.id ? stu : x));
  //};
// 더 이상 사용하지 않음
 const handleUpdateStudent = () => {
   // no-op
 };
  const handleEdit = s => {
      document.body.setAttribute("data-panel", "editStudent");  // ✅ 여기도 추가
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

const [pointLogs, setPointLogs] = useState([]);
useEffect(() => {
  const ref = collection(db, 'point_logs');
  return onSnapshot(ref, qs => {
    const list = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setPointLogs(list);
  });
}, []);
// ✅ 선택된 학생의 총 사용 포인트(차감 합계)
const totalUsedForSelected = useMemo(() => {
  if (!deductionModalStudent) return 0;
  return pointLogs
    .filter(d => d.studentId === deductionModalStudent.id)
    .reduce((sum, d) => sum + (Number(d.point) || 0), 0);
}, [pointLogs, deductionModalStudent]);





 const logoutButton = (
    <div className="fixed top-2 right-2 z-50">
      <Button size="sm" variant="outline" onClick={() => {
        localStorage.removeItem("admin_login");
        window.location.reload();
      }}>로그아웃</Button>
    </div>
  );

  
  // ✅ 가용포인트 초기 동기화: 총포인트와 같지 않은 문서에만 적용
 // useEffect(() => {
  //  students.forEach(async (stu) => {
      // 각 필드별 포인트 합계 계산
   //   const total = pointFields.reduce(
    //    (sum, key) => sum + (pointsData[stu.id]?.[key] || 0),
     //   0
     // );
      // 가용포인트가 다르면 Firestore 에 업데이트
     // if (stu.availablePoints !== total) {
      //  await updateDoc(doc(db, "students", stu.id), { availablePoints: total });
     //   console.log(`Synced availablePoints for ${stu.name}: ${total}`);
    //  }
   // });
 // }, [students, pointsData]);

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
        
           <TabsTrigger value="high">고등부 관리</TabsTrigger>
            <TabsTrigger value="high-payments">고등부 결제</TabsTrigger>
             <TabsTrigger value="high-class-status">수업현황</TabsTrigger>
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
  onChange={e=>setNewStudent(prev => ({ ...prev, name: e.target.value }))}
                />
               <Input
  placeholder="생년월일"
  value={newStudent.birth}
  onChange={e=>setNewStudent(prev => ({ ...prev, birth: e.target.value }))}
                />
              <Input
  placeholder="수업 시작일 (예: 2025-04-13)"
  value={newStudent.startDate}
  onChange={e=>setNewStudent(prev => ({ ...prev, startDate: e.target.value }))}
                />

<Input
  placeholder="루틴 시작 번호 (예: 1)"
  value={newStudent.startRoutine || ''}
  onChange={e => setNewStudent({...newStudent, startRoutine: Number(e.target.value) || 1})}
/>


              <Input
  placeholder="학부모 전화번호"
  value={newStudent.parentPhone}
  onChange={e=>setNewStudent(prev => ({ ...prev, parentPhone: e.target.value }))}

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
                   <div className="flex justify-between items-center mt-2">
   <Button
     size="sm"
     disabled={studentPage === 1}
     onClick={() => setStudentPage(p => Math.max(p - 1, 1))}
   >
     이전
   </Button>
   <span className="text-sm">
     {studentPage} / {totalStudentPages || 1}
   </span>
   <Button
     size="sm"
     disabled={studentPage === totalStudentPages}
     onClick={() => setStudentPage(p => Math.min(p + 1, totalStudentPages))}
   >
     다음
   </Button>
 </div>
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
      {paginatedStudents.map(student => (
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


{selectedPanel === 'calendar' ? (
  <StudentCalendarModal
    student={selectedStudent}

  
  
    onRefreshData={refreshAllData}
    inline={true}
     holidayDates={[...allHolidaySet]}   // ← 통합 휴일 배열 전달
    
  />
) : null}
     { selectedPanel === 'books' ? (
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
                <TableHead>번호</TableHead>               {/* ← 추가 */}
                <TableHead>책 이름</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>완료일</TableHead>
                <TableHead>관리</TableHead>            {/* ← 삭제/수정 합침 */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/** 2) 완료일 내림차순 정렬 & 3) 번호 표시 **/}
              {books
                .filter(b => b.studentId === selectedStudent.id)
                .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
                .map((book, idx) => (
                  <TableRow key={book.id}>
                    <TableCell>{idx + 1}</TableCell>    {/* ← 번호 */}
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.grade}</TableCell>
                    <TableCell>{book.completedDate}</TableCell>
                    <TableCell className="flex gap-1">
                      {/* camelCase로 onClick 속성 수정 */}
                      <Button
                        size="sm"
                        className="px-2 py-1 text-xs"
                        variant="outline"
                        onClick={() => handleEditBook(book)}
                      >
                        수정
                      </Button>
                      <Button
                        size="sm"
                        className="px-2 py-1 text-xs"
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
     ) : selectedPanel === 'comments' ? (
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
          date: commentDate,
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
        .filter(c => c.studentId === selectedStudent.id)  // 원본 코멘트만
        .sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt))
        .map(c => {
          // answer 컬렉션에서 해당 코멘트(parentId) 답변을 불러옴
          const replies = answers.filter(a =>
            a.studentId === selectedStudent.id &&
            a.parentId === c.id
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

              {replies.map(reply => (
                <div key={reply.id} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
                  <div className="text-xs text-gray-500">
                    답변 • {reply.date || reply.createdAt.slice(0, 10)}
                  </div>
                  <div className="text-sm text-gray-800">{reply.comment}</div>
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
) : null}
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
       {['일','월','화','수','목','금','토'].map((d, i) => (
          <th
            key={d}
            className={`p-2 text-center ${i === 0 || i === 6 ? 'text-red-600' : ''}`}
         >
            {d}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {calendarWeeks.map((week, weekIdx) => (
        <tr key={weekIdx}>
        {/* … 기존 calendarWeeks.map 안에서 … */}
{week.map((day, dayIdx) => {
  const fullDateKey = day
    ? `${paymentsMonth}-${String(day).padStart(2,'0')}`
    : null;
const isSun = dayIdx === 0;
  const isSat = dayIdx === 6;
  const isHoliday = !!fullDateKey && allHolidaySet.has(fullDateKey);
  const dayNumCls = (isSun || isSat || isHoliday) ? 'text-red-600' : '';


  return (
    <td key={dayIdx} className={`border p-2 align-top h-24 ${fullDateKey===today?'bg-yellow-100':''}`}>
      {day && (
        <>
<div className={`font-bold mb-1 ${dayNumCls}`}>{day}</div>

          {(paymentSessions[fullDateKey]||[]).map((label, idx) => (
            <div key={idx}>{label}</div>
          ))}
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


{/* ─── 결제완료 탭 ─── */}
<TabsContent value="paid">
  {/* 검색 & 페이징 */}
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
    <Input
      placeholder="학생 이름 검색"
      value={searchName}
      onChange={e => { setSearchName(e.target.value); setPage(0) }}
      style={{ width: 200 }}
    />
    <div>
      <Button size="xs" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ marginRight: 4 }}>
        이전
      </Button>
      <Button size="xs" disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>
        다음
      </Button>
    </div>
  </div>

  <Table striped highlightOnHover>
    <thead>
      <tr>
        <th>학생_루틴번호</th>
        <th>수업시작일</th>
        <th>결제방법</th>
        <th>결제완료</th>
        <th>결제알림</th>
      </tr>
    </thead>
    <tbody>
      {paged.map(item => {
        // docId를 studentName_routineNumber로
        const docId = `${item.name}_${item.routineNumber}`;
        const done  = Boolean(completedMap[docId]?.paymentComplete);
        const method = paymentMethods.find(p =>
          p.studentId === item.studentId && p.routineNumber === item.routineNumber
        )?.paymentMethod || '-';

        return (
          <tr key={docId}>
            <td>{`${item.name}_${item.routineNumber}`}</td>
            <td>{item.date}</td>
            {/* ★ paymentsData에서 paymentMethod 찾아오기 ★ */}
           <td>{
             (paymentsData.find(p =>
               p.studentId === item.studentId &&
               p.routineNumber === item.routineNumber
             )?.paymentMethod) || '-'
           }</td>
           <td>
              <Button
                size="sm"
                color={done ? 'green' : 'blue'}
                onClick={() => handlePaymentComplete(
                  item.studentId,
                  item.routineNumber,
                  item.name   // studentName 전달
                )}
              >
                {done ? '확인!' : '결제완료'}
              </Button>
            </td>
            <td>
              <Button size="sm" variant="outline" disabled>알림</Button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </Table>

  <div style={{ textAlign: 'center', marginTop: 8 }}>
    페이지 {page + 1} / {pageCount}
  </div>
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
             <TableHead>가용 조정</TableHead>
            <TableHead>총합 / 가용</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...students]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(s => (
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

  <TableCell>
     <div className="flex items-center gap-2">
       <Button size="xs" onClick={() => adjustAvailable(s, +1)}>+1</Button>
       <Button size="xs" variant="destructive" onClick={() => adjustAvailable(s, -1)}>-1</Button>
     </div>
   </TableCell>


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

  {/* 차감내역 모달 */}
 {deductionModalStudent && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded p-6 w-[400px] max-h-[70vh] overflow-auto">
      <h2 className="text-lg font-bold mb-4">
        {deductionModalStudent.name}님의 차감내역
      </h2>
{/* ✅ 총 사용합계 표시 */}
  <div className="mb-3 text-sm text-gray-700">
    총 사용: <b>{totalUsedForSelected}</b>점
  </div>
      <ul className="space-y-2">
        {pointLogs.length === 0 ? (
          <li className="text-gray-500">로딩 중...</li>
        ) : (
          pointLogs
            .filter(d => d.studentId === deductionModalStudent.id)
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map(d => (
              <li key={d.id} className="border p-2 rounded relative">
                <div className="text-sm font-semibold">🛍 {d.item}</div>
                <div className="text-sm">포인트: -{d.point}점</div>
                <div className="text-xs text-gray-500">{d.date}</div>
              </li>
            ))
        )}
        {pointLogs.filter(d => d.studentId === deductionModalStudent.id).length === 0 && (
          <li className="text-gray-500">차감 내역이 없습니다.</li>
        )}
      </ul>

        <div className="mt-4 text-right">
          <Button variant="outline" onClick={() => setDeductionModalStudent(null)}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )}
</TabsContent>

{/* 포인트상점 */}
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
          placeholder="이미지 URL (사용 안 함)"
          value={newShopItem.imageUrl}
          onChange={e => setNewShopItem({ ...newShopItem, imageUrl: e.target.value })}
        />
        <Button onClick={handleAddShopItem}>상품 등록</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...shopItems]
          .sort((a, b) => a.point - b.point) // 낮은 포인트순 정렬
          .map(item => (
            <div key={item.id} className="border p-3 rounded shadow-sm">
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
        {/* 🔧 여기에 모드 안내 문구를 추가 */}
     <h2 className="text-xl font-semibold">
       {selectedNotice ? '🔧 공지사항 수정' : '📝 공지사항 추가'}
     </h2>
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
 </div>

        {/* 리치 에디터 ReactQuill */}
         <div className="mt-2">
 <ReactQuill
   theme="snow"
   value={noticeContent}
     onChange={setNoticeContent}
  
   modules={{
     toolbar: [
       [{ header: [1, 2, 3, false] }],
       ['bold', 'italic', 'underline', 'strike'],
       [{ color: [] }, { background: [] }],
       [{ align: [] }],
       ['link', 'image'],
       ['clean']
     ]
   }}
   formats={[
     'header', 'bold', 'italic', 'underline', 'strike',
     'color', 'background', 'align',
     'link', 'image'
   ]}
   className="w-full h-48"  /* 높이는 필요에 맞게 조절 */
 />
 </div>

   <div className="relative z-10 mt-2">
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
            <TableHead>내용</TableHead>  
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
    <div
      className="prose max-w-none whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: notice.content }}
    />
  </TableCell>
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
<TabsContent value="high-class-status">
  <div className="flex gap-6">
    {/* ─── 왼쪽: 고등부 학생 선택 리스트 ─── */}
    <aside className="w-48 space-y-2">
      {highStudents.map(s => (
        <Button
          key={s.id}
          variant={selectedHighStudent?.id === s.id ? 'primary' : 'outline'}
          className="w-full text-left"
          onClick={() => {
            setSelectedHighStudent(s);
            setSessionPageIndex(0);
            setHighMonth(new Date().toISOString().slice(0,7));
          }}
        >
          {s.name}
        </Button>
      ))}
    </aside>

    {/* ─── 오른쪽: 선택된 학생 수업현황 ─── */}
    <section className="flex-1 space-y-4">
      {!selectedHighStudent ? (
        <p className="text-gray-500">학생을 선택하세요.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold">
            {selectedHighStudent.name} 수업현황
          </h2>

          {/* 날짜 추가 UI */}
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="month"
              label="연·월"
              value={highMonth}
              onChange={e => setHighMonth(e.target.value)}
            />
            <Input
              type="date"
              label="새 날짜"
              value={newHighDate}
              onChange={e => setNewHighDate(e.target.value)}
            />
            <Button size="sm" onClick={handleAddHighDate}>
              날짜 추가
            </Button>
          </div>

          {/* 페이징 네비게이션 */}
          {selectedHighStudent.type === '월제' ? (
            <div className="flex gap-2 items-center">
              <Button size="xs" onClick={() => {
                const [y,m] = highMonth.split('-').map(Number);
                const prev = new Date(y, m-2, 1);
                setHighMonth(`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`);
              }}>◀ 이전월</Button>
              <span className="font-medium">{highMonth}</span>
              <Button size="xs" onClick={() => {
                const [y,m] = highMonth.split('-').map(Number);
                const next = new Date(y, m, 1);
                setHighMonth(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`);
              }}>다음월 ▶</Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <Button
                size="xs"
                disabled={sessionPageIndex === 0}
                onClick={() => setSessionPageIndex(i => i - 1)}
              >
                ◀ 이전
              </Button>
              <span className="font-medium">
                {sessionPageIndex + 1} / {Math.ceil(
                  highAttendanceDates
                    .filter(d => d.data[selectedHighStudent.name])
                    .length / 8
                )}
              </span>
              <Button
                size="xs"
                disabled={
                  sessionPageIndex >=
                  Math.ceil(
                    highAttendanceDates.filter(d => d.data[selectedHighStudent.name]).length / 8
                  ) - 1
                }
                onClick={() => setSessionPageIndex(i => i + 1)}
              >
                다음 ▶
              </Button>
            </div>
          )}

          {/* 날짜 목록 테이블 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>삭제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // 1) 해당 학생에게 출석 기록이 있는 날짜만 필터
                const ownDates = highAttendanceDates
                  .filter(d => d.data[selectedHighStudent.name]);

                // 2) 월제인 경우 월별, 횟수제인 경우 페이징
                const filtered = selectedHighStudent.type === '월제'
                  ? ownDates.filter(d => d.id.startsWith(highMonth))
                  : ownDates.slice(
                      sessionPageIndex * 8,
                      sessionPageIndex * 8 + 8
                    );

                if (filtered.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500">
                        표시할 날짜가 없습니다.
                      </TableCell>
                    </TableRow>
                  );
                }

               return filtered.map((d, index) => (
                 <TableRow key={d.id}>
                  <TableCell>
    {index + 1}. {d.id}
  </TableCell>
                  <TableCell>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => handleDeleteHighDate(d.id)}
                      >
                        삭제
                      </Button>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </>
      )}
    </section>
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
            <TableHead>삭제</TableHead>
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
           // 페이지 단위로 자른 뒤 렌더링
            loginLogs
              .slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage)
              .map(log => (
              <TableRow key={log.id}>
                <TableCell>{log.studentName}</TableCell>
                 <TableCell>
                  {log.loginTime
                    ? new Date(log.loginTime)
                        .toLocaleString('ko-KR', { hour12: false })
                    : ''}
                </TableCell>
                <TableCell>
                  <Button
                    size="xs"
                   variant="destructive"
                    onClick={() => handleDeleteLog(log.id)}
                  >
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

 {/* ─── 페이지네이션 컨트롤 ─── */}
      {loginLogs.length > logsPerPage && (
        <div className="flex justify-center gap-2 mt-2">
          <Button
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            이전
          </Button>
          <span className="px-2">
            페이지 {currentPage} / {Math.ceil(loginLogs.length / logsPerPage)}
          </span>
          <Button
            size="sm"
            disabled={currentPage === Math.ceil(loginLogs.length / logsPerPage)}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            다음
          </Button>
        </div>
      )}

    </CardContent>
  </Card>
</TabsContent>










      </Tabs>

     

    </div>
  );
}
