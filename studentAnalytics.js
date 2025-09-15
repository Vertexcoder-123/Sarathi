// Student Analytics Module
class StudentAnalytics {
    constructor(db) {
        this.db = db;
    }

    async calculatePerformanceMetrics(studentId) {
        try {
            const progressData = await this.getStudentProgress(studentId);
            if (!progressData) return null;

            return {
                overall: this.calculateOverallPerformance(progressData),
                subjects: this.calculateSubjectPerformance(progressData),
                timeline: this.generatePerformanceTimeline(progressData),
                strengths: this.identifyStrengths(progressData),
                gaps: this.identifyKnowledgeGaps(progressData),
                recommendations: this.generateRecommendations(progressData)
            };
        } catch (error) {
            console.error('Error calculating performance metrics:', error);
            throw error;
        }
    }

    async getStudentProgress(studentId) {
        try {
            const progressSnapshot = await this.db.collection('studentProgress')
                .doc(studentId)
                .collection('details')
                .orderBy('timestamp', 'desc')
                .get();

            return progressSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching student progress:', error);
            return null;
        }
    }

    calculateOverallPerformance(progressData) {
        const recentProgress = progressData.slice(0, 10); // Consider last 10 activities
        
        const overall = {
            averageScore: 0,
            completionRate: 0,
            timeSpent: 0,
            trend: 0
        };

        if (recentProgress.length === 0) return overall;

        // Calculate averages
        overall.averageScore = recentProgress.reduce((sum, p) => sum + p.score, 0) / recentProgress.length;
        overall.completionRate = recentProgress.filter(p => p.completed).length / recentProgress.length * 100;
        overall.timeSpent = recentProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

        // Calculate trend (comparing with previous period)
        const currentAvg = recentProgress.slice(0, 5).reduce((sum, p) => sum + p.score, 0) / 5;
        const previousAvg = recentProgress.slice(5, 10).reduce((sum, p) => sum + p.score, 0) / 5;
        overall.trend = currentAvg - previousAvg;

        return overall;
    }

    calculateSubjectPerformance(progressData) {
        const subjects = {};

        progressData.forEach(progress => {
            const subject = progress.subject;
            if (!subjects[subject]) {
                subjects[subject] = {
                    totalScore: 0,
                    count: 0,
                    highScore: 0,
                    lowScore: 100,
                    recentScores: []
                };
            }

            subjects[subject].totalScore += progress.score;
            subjects[subject].count++;
            subjects[subject].highScore = Math.max(subjects[subject].highScore, progress.score);
            subjects[subject].lowScore = Math.min(subjects[subject].lowScore, progress.score);
            subjects[subject].recentScores.push(progress.score);
        });

        // Calculate averages and trends
        Object.keys(subjects).forEach(subject => {
            const subjectData = subjects[subject];
            subjectData.average = subjectData.totalScore / subjectData.count;
            subjectData.recentAverage = subjectData.recentScores.slice(-5).reduce((a, b) => a + b, 0) / 5;
            subjectData.trend = subjectData.recentAverage - (subjectData.recentScores.slice(-10, -5).reduce((a, b) => a + b, 0) / 5);
        });

        return subjects;
    }

    generatePerformanceTimeline(progressData) {
        const timeline = {
            daily: {},
            weekly: {},
            monthly: {}
        };

        // Group by day
        progressData.forEach(progress => {
            const date = new Date(progress.timestamp);
            const dayKey = date.toISOString().split('T')[0];
            const weekKey = this.getWeekNumber(date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

            // Daily aggregation
            if (!timeline.daily[dayKey]) {
                timeline.daily[dayKey] = {
                    scores: [],
                    completed: 0,
                    timeSpent: 0
                };
            }
            timeline.daily[dayKey].scores.push(progress.score);
            timeline.daily[dayKey].completed += progress.completed ? 1 : 0;
            timeline.daily[dayKey].timeSpent += progress.timeSpent || 0;

            // Weekly aggregation
            if (!timeline.weekly[weekKey]) {
                timeline.weekly[weekKey] = {
                    scores: [],
                    completed: 0,
                    timeSpent: 0
                };
            }
            timeline.weekly[weekKey].scores.push(progress.score);
            timeline.weekly[weekKey].completed += progress.completed ? 1 : 0;
            timeline.weekly[weekKey].timeSpent += progress.timeSpent || 0;

            // Monthly aggregation
            if (!timeline.monthly[monthKey]) {
                timeline.monthly[monthKey] = {
                    scores: [],
                    completed: 0,
                    timeSpent: 0
                };
            }
            timeline.monthly[monthKey].scores.push(progress.score);
            timeline.monthly[monthKey].completed += progress.completed ? 1 : 0;
            timeline.monthly[monthKey].timeSpent += progress.timeSpent || 0;
        });

        // Calculate averages
        ['daily', 'weekly', 'monthly'].forEach(period => {
            Object.keys(timeline[period]).forEach(key => {
                const data = timeline[period][key];
                data.averageScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            });
        });

        return timeline;
    }

    identifyStrengths(progressData) {
        const strengths = [];
        const subjectPerformance = this.calculateSubjectPerformance(progressData);

        // Identify subjects with consistently high performance
        Object.entries(subjectPerformance).forEach(([subject, data]) => {
            if (data.average >= 80 && data.trend >= 0) {
                strengths.push({
                    subject,
                    score: data.average,
                    consistency: data.recentScores.every(score => score >= 70)
                });
            }
        });

        return strengths.sort((a, b) => b.score - a.score);
    }

    identifyKnowledgeGaps(progressData) {
        const gaps = [];
        const subjectPerformance = this.calculateSubjectPerformance(progressData);

        // Identify subjects with low or declining performance
        Object.entries(subjectPerformance).forEach(([subject, data]) => {
            if (data.average < 60 || data.trend < -10) {
                gaps.push({
                    subject,
                    averageScore: data.average,
                    trend: data.trend,
                    priority: this.calculateGapPriority(data),
                    recommendations: this.generateSubjectRecommendations(subject, data)
                });
            }
        });

        return gaps.sort((a, b) => b.priority - a.priority);
    }

    calculateGapPriority(subjectData) {
        let priority = 0;
        
        // Low average score increases priority
        if (subjectData.average < 50) priority += 3;
        else if (subjectData.average < 60) priority += 2;
        else if (subjectData.average < 70) priority += 1;

        // Negative trend increases priority
        if (subjectData.trend < -15) priority += 3;
        else if (subjectData.trend < -10) priority += 2;
        else if (subjectData.trend < -5) priority += 1;

        // Recent poor performance increases priority
        const recentPoorPerformance = subjectData.recentScores.slice(-3).filter(score => score < 60).length;
        priority += recentPoorPerformance;

        return priority;
    }

    generateSubjectRecommendations(subject, data) {
        const recommendations = [];

        // Basic recommendations based on performance patterns
        if (data.average < 50) {
            recommendations.push({
                type: 'foundation',
                description: `Review fundamental concepts in ${subject}`,
                resources: ['basic tutorials', 'practice exercises']
            });
        }

        if (data.trend < -10) {
            recommendations.push({
                type: 'practice',
                description: `Increase practice frequency in ${subject}`,
                resources: ['daily exercises', 'interactive quizzes']
            });
        }

        if (data.recentScores.some(score => score < 40)) {
            recommendations.push({
                type: 'support',
                description: `Seek additional support for ${subject}`,
                resources: ['teacher consultation', 'peer study groups']
            });
        }

        return recommendations;
    }

    generateRecommendations(progressData) {
        const recommendations = [];
        const strengths = this.identifyStrengths(progressData);
        const gaps = this.identifyKnowledgeGaps(progressData);

        // Add recommendations based on knowledge gaps
        gaps.forEach(gap => {
            recommendations.push({
                type: 'improvement',
                priority: gap.priority,
                subject: gap.subject,
                description: `Focus on improving ${gap.subject} performance`,
                specific: gap.recommendations
            });
        });

        // Add recommendations based on strengths
        strengths.forEach(strength => {
            recommendations.push({
                type: 'advancement',
                priority: 1,
                subject: strength.subject,
                description: `Consider advanced materials in ${strength.subject}`,
                specific: [{
                    type: 'challenge',
                    description: `Take on more challenging ${strength.subject} missions`
                }]
            });
        });

        // Sort by priority
        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
}

export const studentAnalytics = new StudentAnalytics(firebase.firestore());