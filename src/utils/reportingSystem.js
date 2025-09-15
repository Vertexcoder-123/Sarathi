import { db } from '../config/firebase-config.js';

/**
 * ReportingSystem Module
 * Handles all reporting and analytics functionality
 */
class ReportingSystem {
    constructor() {
        this.db = db;
    }

    async generateReport(options) {
        const {
            type,
            timeframe,
            classId,
            studentIds,
            subjects
        } = options;

        try {
            switch (type) {
                case 'class':
                    return await this.generateClassReport(classId, timeframe);
                case 'individual':
                    return await this.generateIndividualReports(studentIds, timeframe);
                case 'subject':
                    return await this.generateSubjectReport(classId, subjects, timeframe);
                case 'progress':
                    return await this.generateProgressReport(classId, timeframe);
                default:
                    throw new Error('Invalid report type');
            }
        } catch (error) {
            console.error('Error generating report:', error);
            throw error;
        }
    }

    async generateClassReport(classId, timeframe) {
        const startDate = this.getStartDate(timeframe);
        
        try {
            // Get class data
            const classDoc = await this.db.collection('classes').doc(classId).get();
            const classData = classDoc.data();

            // Get all students in class
            const studentsSnapshot = await this.db.collection('students')
                .where('classId', '==', classId)
                .get();

            // Get progress data for all students
            const progressPromises = studentsSnapshot.docs.map(async studentDoc => {
                const progressDocs = await this.db.collection('studentProgress')
                    .doc(studentDoc.id)
                    .collection('details')
                    .where('timestamp', '>=', startDate)
                    .orderBy('timestamp', 'desc')
                    .get();

                return {
                    studentId: studentDoc.id,
                    studentName: studentDoc.data().name,
                    progress: progressDocs.docs.map(doc => doc.data())
                };
            });

            const studentsProgress = await Promise.all(progressPromises);

            // Analyze class performance
            const analysis = this.analyzeClassPerformance(studentsProgress, classData);

            return {
                reportType: 'class',
                timeframe,
                className: classData.name,
                generatedAt: new Date(),
                metrics: analysis.metrics,
                trends: analysis.trends,
                distribution: analysis.distribution,
                recommendations: analysis.recommendations
            };
        } catch (error) {
            console.error('Error generating class report:', error);
            throw error;
        }
    }

    analyzeClassPerformance(studentsProgress, classData) {
        const analysis = {
            metrics: {
                totalStudents: studentsProgress.length,
                activeStudents: 0,
                averageScore: 0,
                completionRate: 0
            },
            trends: {
                daily: {},
                weekly: {},
                monthly: {}
            },
            distribution: {
                scores: {
                    '0-20': 0,
                    '21-40': 0,
                    '41-60': 0,
                    '61-80': 0,
                    '81-100': 0
                },
                subjects: {}
            },
            recommendations: []
        };

        let totalScore = 0;
        let totalActivities = 0;

        studentsProgress.forEach(student => {
            if (student.progress.length > 0) {
                analysis.metrics.activeStudents++;
            }

            student.progress.forEach(activity => {
                // Update average score
                totalScore += activity.score;
                totalActivities++;

                // Update score distribution
                const scoreRange = Math.floor(activity.score / 20) * 20;
                const rangeKey = `${scoreRange}-${scoreRange + 20}`;
                analysis.distribution.scores[rangeKey]++;

                // Update subject performance
                if (!analysis.distribution.subjects[activity.subject]) {
                    analysis.distribution.subjects[activity.subject] = {
                        totalScore: 0,
                        activities: 0
                    };
                }
                analysis.distribution.subjects[activity.subject].totalScore += activity.score;
                analysis.distribution.subjects[activity.subject].activities++;

                // Update trends
                this.updateTrends(analysis.trends, activity);
            });
        });

        // Calculate final metrics
        analysis.metrics.averageScore = totalActivities > 0 ? 
            Math.round(totalScore / totalActivities) : 0;
        analysis.metrics.completionRate = analysis.metrics.activeStudents / 
            analysis.metrics.totalStudents * 100;

        // Generate recommendations based on analysis
        analysis.recommendations = this.generateClassRecommendations(analysis);

        return analysis;
    }

    updateTrends(trends, activity) {
        const date = new Date(activity.timestamp);
        const dayKey = date.toISOString().split('T')[0];
        const weekKey = this.getWeekNumber(date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

        // Update daily trends
        if (!trends.daily[dayKey]) {
            trends.daily[dayKey] = {
                scores: [],
                completed: 0
            };
        }
        trends.daily[dayKey].scores.push(activity.score);
        trends.daily[dayKey].completed++;

        // Update weekly trends
        if (!trends.weekly[weekKey]) {
            trends.weekly[weekKey] = {
                scores: [],
                completed: 0
            };
        }
        trends.weekly[weekKey].scores.push(activity.score);
        trends.weekly[weekKey].completed++;

        // Update monthly trends
        if (!trends.monthly[monthKey]) {
            trends.monthly[monthKey] = {
                scores: [],
                completed: 0
            };
        }
        trends.monthly[monthKey].scores.push(activity.score);
        trends.monthly[monthKey].completed++;
    }

    generateClassRecommendations(analysis) {
        const recommendations = [];

        // Analyze participation
        if (analysis.metrics.activeStudents < analysis.metrics.totalStudents * 0.8) {
            recommendations.push({
                type: 'participation',
                priority: 'high',
                description: 'Increase class participation rate',
                actions: [
                    'Identify inactive students and reach out individually',
                    'Consider implementing engagement incentives',
                    'Review accessibility issues that might be barriers to participation'
                ]
            });
        }

        // Analyze subject performance
        Object.entries(analysis.distribution.subjects).forEach(([subject, data]) => {
            const averageScore = data.totalScore / data.activities;
            if (averageScore < 60) {
                recommendations.push({
                    type: 'subject',
                    priority: 'high',
                    subject: subject,
                    description: `Improve class performance in ${subject}`,
                    actions: [
                        'Review teaching methods for this subject',
                        'Consider additional practice sessions',
                        'Identify specific topics causing difficulty'
                    ]
                });
            }
        });

        // Analyze score distribution
        const lowScores = analysis.distribution.scores['0-20'] + 
                         analysis.distribution.scores['21-40'];
        const totalScores = Object.values(analysis.distribution.scores)
                                 .reduce((a, b) => a + b, 0);
        
        if (lowScores / totalScores > 0.2) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                description: 'Address low performance scores',
                actions: [
                    'Implement remedial sessions for struggling students',
                    'Review difficulty level of assignments',
                    'Consider peer tutoring program'
                ]
            });
        }

        return recommendations;
    }

    getStartDate(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case 'day':
                return new Date(now.setDate(now.getDate() - 1));
            case 'week':
                return new Date(now.setDate(now.getDate() - 7));
            case 'month':
                return new Date(now.setMonth(now.getMonth() - 1));
            case 'quarter':
                return new Date(now.setMonth(now.getMonth() - 3));
            default:
                return new Date(now.setMonth(now.getMonth() - 1)); // Default to last month
        }
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    async generateIndividualReports(studentIds, timeframe) {
        const startDate = this.getStartDate(timeframe);
        const reports = [];

        for (const studentId of studentIds) {
            try {
                // Get student data
                const studentDoc = await this.db.collection('students').doc(studentId).get();
                const studentData = studentDoc.data();

                // Get student progress
                const progressDocs = await this.db.collection('studentProgress')
                    .doc(studentId)
                    .collection('details')
                    .where('timestamp', '>=', startDate)
                    .orderBy('timestamp', 'desc')
                    .get();

                const progress = progressDocs.docs.map(doc => doc.data());

                // Generate individual analysis
                const analysis = await this.analyzeIndividualPerformance(progress, studentData);

                reports.push({
                    studentId,
                    studentName: studentData.name,
                    reportType: 'individual',
                    timeframe,
                    generatedAt: new Date(),
                    ...analysis
                });
            } catch (error) {
                console.error(`Error generating report for student ${studentId}:`, error);
                // Continue with other students even if one fails
            }
        }

        return reports;
    }

    async analyzeIndividualPerformance(progress, studentData) {
        // Use studentAnalytics for detailed analysis
        const analytics = (await import('./studentAnalytics.js')).studentAnalytics;
        return analytics.calculatePerformanceMetrics(studentData.id);
    }

    async generateSubjectReport(classId, subjects, timeframe) {
        const startDate = this.getStartDate(timeframe);
        const report = {
            reportType: 'subject',
            timeframe,
            generatedAt: new Date(),
            subjects: {}
        };

        for (const subject of subjects) {
            try {
                const subjectProgress = await this.db.collection('studentProgress')
                    .where('classId', '==', classId)
                    .where('subject', '==', subject)
                    .where('timestamp', '>=', startDate)
                    .get();

                report.subjects[subject] = this.analyzeSubjectPerformance(
                    subjectProgress.docs.map(doc => doc.data())
                );
            } catch (error) {
                console.error(`Error analyzing subject ${subject}:`, error);
                // Continue with other subjects even if one fails
            }
        }

        return report;
    }

    analyzeSubjectPerformance(progressData) {
        const analysis = {
            averageScore: 0,
            totalActivities: progressData.length,
            difficultyLevels: {},
            commonMistakes: {},
            timeDistribution: {},
            recommendations: []
        };

        if (progressData.length === 0) return analysis;

        let totalScore = 0;

        progressData.forEach(activity => {
            totalScore += activity.score;

            // Analyze difficulty levels
            const difficulty = activity.difficulty || 'medium';
            if (!analysis.difficultyLevels[difficulty]) {
                analysis.difficultyLevels[difficulty] = {
                    count: 0,
                    avgScore: 0
                };
            }
            analysis.difficultyLevels[difficulty].count++;
            analysis.difficultyLevels[difficulty].avgScore += activity.score;

            // Track common mistakes
            if (activity.mistakes) {
                activity.mistakes.forEach(mistake => {
                    if (!analysis.commonMistakes[mistake]) {
                        analysis.commonMistakes[mistake] = 0;
                    }
                    analysis.commonMistakes[mistake]++;
                });
            }

            // Analyze time spent
            const timeRange = this.categorizeTime(activity.timeSpent);
            if (!analysis.timeDistribution[timeRange]) {
                analysis.timeDistribution[timeRange] = 0;
            }
            analysis.timeDistribution[timeRange]++;
        });

        // Calculate averages
        analysis.averageScore = Math.round(totalScore / progressData.length);

        // Calculate averages for each difficulty level
        Object.keys(analysis.difficultyLevels).forEach(difficulty => {
            const level = analysis.difficultyLevels[difficulty];
            level.avgScore = Math.round(level.avgScore / level.count);
        });

        // Generate subject-specific recommendations
        analysis.recommendations = this.generateSubjectRecommendations(analysis);

        return analysis;
    }

    categorizeTime(timeSpent) {
        if (!timeSpent) return 'unknown';
        if (timeSpent < 300) return '0-5min';
        if (timeSpent < 600) return '5-10min';
        if (timeSpent < 1200) return '10-20min';
        return '20min+';
    }

    generateSubjectRecommendations(analysis) {
        const recommendations = [];

        // Analyze overall performance
        if (analysis.averageScore < 60) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                description: 'Overall subject performance needs improvement',
                actions: [
                    'Review teaching methodology',
                    'Provide additional learning resources',
                    'Consider prerequisite topics that might need reinforcement'
                ]
            });
        }

        // Analyze difficulty levels
        if (analysis.difficultyLevels.hard && 
            analysis.difficultyLevels.hard.avgScore < 50) {
            recommendations.push({
                type: 'difficulty',
                priority: 'medium',
                description: 'Students struggling with higher difficulty content',
                actions: [
                    'Provide more scaffolding for difficult topics',
                    'Include intermediate difficulty levels',
                    'Create study guides for challenging content'
                ]
            });
        }

        // Analyze time distribution
        const longDuration = analysis.timeDistribution['20min+'] || 0;
        if (longDuration / analysis.totalActivities > 0.3) {
            recommendations.push({
                type: 'time',
                priority: 'medium',
                description: 'Many activities taking longer than expected',
                actions: [
                    'Review activity complexity',
                    'Consider breaking down longer activities',
                    'Provide time management strategies'
                ]
            });
        }

        // Analyze common mistakes
        const mistakes = Object.entries(analysis.commonMistakes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        if (mistakes.length > 0) {
            recommendations.push({
                type: 'mistakes',
                priority: 'high',
                description: 'Common mistakes identified',
                actions: [
                    'Focus on frequently misunderstood concepts',
                    'Create targeted practice exercises',
                    'Develop specific intervention strategies'
                ],
                details: mistakes.map(([mistake, count]) => ({
                    issue: mistake,
                    frequency: count
                }))
            });
        }

        return recommendations;
    }

    async generateProgressReport(classId, timeframe) {
        const startDate = this.getStartDate(timeframe);
        
        try {
            // Get class progress data
            const progressSnapshot = await this.db.collection('studentProgress')
                .where('classId', '==', classId)
                .where('timestamp', '>=', startDate)
                .orderBy('timestamp', 'desc')
                .get();

            const progressData = progressSnapshot.docs.map(doc => doc.data());

            // Analyze progress
            return {
                reportType: 'progress',
                timeframe,
                generatedAt: new Date(),
                ...this.analyzeProgress(progressData)
            };
        } catch (error) {
            console.error('Error generating progress report:', error);
            throw error;
        }
    }

    analyzeProgress(progressData) {
        const analysis = {
            overall: {
                totalActivities: progressData.length,
                averageScore: 0,
                completionRate: 0,
                timeSpent: 0
            },
            timeline: {
                scores: {},
                activities: {},
                completion: {}
            },
            achievements: [],
            areas: {
                improvement: [],
                strength: []
            }
        };

        if (progressData.length === 0) return analysis;

        let totalScore = 0;
        let totalCompleted = 0;
        let totalTime = 0;

        progressData.forEach(progress => {
            // Update overall metrics
            totalScore += progress.score;
            if (progress.completed) totalCompleted++;
            totalTime += progress.timeSpent || 0;

            // Update timeline data
            const date = new Date(progress.timestamp).toISOString().split('T')[0];
            if (!analysis.timeline.scores[date]) {
                analysis.timeline.scores[date] = [];
                analysis.timeline.activities[date] = 0;
                analysis.timeline.completion[date] = 0;
            }
            analysis.timeline.scores[date].push(progress.score);
            analysis.timeline.activities[date]++;
            if (progress.completed) {
                analysis.timeline.completion[date]++;
            }
        });

        // Calculate averages
        analysis.overall.averageScore = Math.round(totalScore / progressData.length);
        analysis.overall.completionRate = Math.round(totalCompleted / progressData.length * 100);
        analysis.overall.timeSpent = totalTime;

        // Calculate daily averages
        Object.keys(analysis.timeline.scores).forEach(date => {
            const scores = analysis.timeline.scores[date];
            analysis.timeline.scores[date] = Math.round(
                scores.reduce((a, b) => a + b, 0) / scores.length
            );
        });

        // Identify achievements
        analysis.achievements = this.identifyAchievements(progressData);

        // Identify areas of improvement and strength
        const subjects = this.groupBySubject(progressData);
        Object.entries(subjects).forEach(([subject, data]) => {
            if (data.averageScore >= 80) {
                analysis.areas.strength.push({
                    subject,
                    score: data.averageScore,
                    trend: data.trend
                });
            } else if (data.averageScore < 60) {
                analysis.areas.improvement.push({
                    subject,
                    score: data.averageScore,
                    trend: data.trend
                });
            }
        });

        return analysis;
    }

    identifyAchievements(progressData) {
        const achievements = [];

        // Check for high scores
        const highScores = progressData.filter(p => p.score >= 90).length;
        if (highScores >= 5) {
            achievements.push({
                type: 'high_scores',
                description: `Achieved ${highScores} high scores`,
                level: this.getAchievementLevel(highScores, [5, 10, 20])
            });
        }

        // Check for completion streaks
        const streaks = this.calculateStreaks(progressData);
        if (streaks.max >= 3) {
            achievements.push({
                type: 'streak',
                description: `${streaks.max} day completion streak`,
                level: this.getAchievementLevel(streaks.max, [3, 5, 7])
            });
        }

        // Check for subject mastery
        const subjects = this.groupBySubject(progressData);
        Object.entries(subjects).forEach(([subject, data]) => {
            if (data.averageScore >= 85 && data.activities >= 5) {
                achievements.push({
                    type: 'subject_mastery',
                    subject,
                    description: `Mastered ${subject}`,
                    level: this.getAchievementLevel(data.averageScore, [85, 90, 95])
                });
            }
        });

        return achievements;
    }

    getAchievementLevel(value, thresholds) {
        if (value >= thresholds[2]) return 'gold';
        if (value >= thresholds[1]) return 'silver';
        return 'bronze';
    }

    calculateStreaks(progressData) {
        const dailyCompletion = {};
        progressData.forEach(progress => {
            const date = new Date(progress.timestamp).toISOString().split('T')[0];
            dailyCompletion[date] = true;
        });

        let currentStreak = 0;
        let maxStreak = 0;
        let lastDate = null;

        Object.keys(dailyCompletion)
            .sort()
            .forEach(date => {
                if (!lastDate) {
                    currentStreak = 1;
                } else {
                    const dayDiff = Math.round(
                        (new Date(date) - new Date(lastDate)) / (1000 * 60 * 60 * 24)
                    );
                    if (dayDiff === 1) {
                        currentStreak++;
                    } else {
                        currentStreak = 1;
                    }
                }
                maxStreak = Math.max(maxStreak, currentStreak);
                lastDate = date;
            });

        return {
            current: currentStreak,
            max: maxStreak
        };
    }

    groupBySubject(progressData) {
        const subjects = {};

        progressData.forEach(progress => {
            if (!subjects[progress.subject]) {
                subjects[progress.subject] = {
                    totalScore: 0,
                    activities: 0,
                    recentScores: []
                };
            }

            subjects[progress.subject].totalScore += progress.score;
            subjects[progress.subject].activities++;
            subjects[progress.subject].recentScores.push(progress.score);
        });

        // Calculate averages and trends
        Object.values(subjects).forEach(subject => {
            subject.averageScore = Math.round(subject.totalScore / subject.activities);
            
            const recentAvg = subject.recentScores.slice(-5).reduce((a, b) => a + b, 0) / 5;
            const previousAvg = subject.recentScores.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
            subject.trend = recentAvg - previousAvg;
        });

        return subjects;
    }
}

// Export a singleton instance of the ReportingSystem
    }
}

// Export a singleton instance of the ReportingSystem
export const reportingSystem = new ReportingSystem();