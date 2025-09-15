/**
 * leaderboard.js
 * This script contains the Leaderboard class, which is responsible for
 * fetching and managing leaderboard data from the Firebase Firestore backend.
 */

class Leaderboard {
    /**
     * @param {firebase.firestore.Firestore} db The Firestore database instance.
     */
    constructor(db) {
        if (!db) {
            throw new Error("A Firebase Firestore database instance is required to initialize the Leaderboard.");
        }
        this.db = db;
        // We assume a collection 'studentProfiles' where summary data like total XP is stored.
        // This is more efficient than calculating totals from all progress documents every time.
        this.collectionName = 'studentProfiles';
    }

    /**
     * Fetches the top student profiles from Firestore, ordered by XP.
     * @param {number} [limit=10] The number of top students to retrieve.
     * @returns {Promise<Array<Object>>} A promise that resolves to an array of student data objects.
     */
    async getTopStudents(limit = 10) {
        try {
            const leaderboardCollection = this.db.collection(this.collectionName);

            // Query the collection, order by the 'xp' field in descending order, and limit the results.
            const snapshot = await leaderboardCollection.orderBy('xp', 'desc').limit(limit).get();

            if (snapshot.empty) {
                console.log("No student profiles found for the leaderboard.");
                return [];
            }

            // Map the document data to a clean array of objects.
            const topStudents = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || 'Anonymous',
                xp: doc.data().xp || 0
            }));

            return topStudents;

        } catch (error) {
            console.error("Error fetching leaderboard data from Firestore:", error);
            // Return an empty array in case of an error to prevent the UI from breaking.
            return [];
        }
    }
}
