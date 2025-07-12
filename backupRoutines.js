// backupRoutines.js
const admin = require("firebase-admin");

// 1️⃣ 서비스 계정 키 JSON 불러오기
const serviceAccount = require("./serviceAccountKey.json");

// 2️⃣ Firebase Admin 초기화 (서비스 계정 인증)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backupRoutines() {
  const routines = await db.collection("routines").get();
  for (const docSnap of routines.docs) {
    const data = docSnap.data();
    // routines_backup 에 원본 그대로 복사
    await db
      .collection("routines_backup")
      .doc(docSnap.id)
      .set(data);
    console.log(`Backed up routines/${docSnap.id}`);
  }
  console.log("✅ 백업 완료: routines_backup 컬렉션을 확인하세요.");
}

backupRoutines().catch(console.error);
