// cleanupRoutines.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");  // 백업 때 사용한 키

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function cleanupRoutines() {
  const routinesSnap = await db.collection("routines").get();

  for (const docSnap of routinesSnap.docs) {
    const docId = docSnap.id;
    const data = docSnap.data();
    const oldLessons = data.lessons || [];

    // 1) '미정' status 회차만 필터링해 제거
    const filtered = oldLessons.filter(l => l.status !== '미정');

    // 2) 남은 회차에서 date/session/routineNumber 필드만 추출
    const cleaned = filtered.map(l => ({
      date:          l.date,
      session:       l.session,
      routineNumber: l.routineNumber
    }));

    // 3) Firestore 업데이트
    await db.collection("routines").doc(docId).update({
      lessons: cleaned
    });

    console.log(`✅ ${docId}: ${oldLessons.length - cleaned.length}개 제거, ${cleaned.length}개 남김`);
  }

  console.log("▶ 모든 routines 문서 정리 완료");
}

cleanupRoutines().catch(err => {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
});
