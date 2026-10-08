// Fetch brothers ordered by first name, returning an empty list on failure.
export async function loadBrotherDirectory({ db, collection, query, orderBy, getDocs, logError }) {
    try {
        // Firestore supplies firstname ordering for the voting dashboard's brother list.
        const brothersRef = collection(db, "brothers");
        const q = query(brothersRef, orderBy("firstname"));
        const querySnapshot = await getDocs(q);

        const brothers = [];
        querySnapshot.forEach((doc) => {
            // Copy the Firestore document ID and brother profile fields into the directory.
            const data = doc.data();
            brothers.push({
                _id: doc.id,
                uid: data.uid,
                firstname: data.firstname,
                lastname: data.lastname,
                email: data.email,
                displayName: data.displayName,
            });
        });

        return brothers;
    } catch (error) {
        logError("Error fetching brothers:", error);
        return [];
    }
}
