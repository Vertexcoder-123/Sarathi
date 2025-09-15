import { db } from '../config/firebase-config.js';
import { reportingSystem } from '../utils/reportingSystem.js';
import { studentAnalytics } from '../utils/studentAnalytics.js';

/**
 * TeacherDashboard class provides functionality for managing teacher's view
 * including student performance tracking, reports generation, and classroom management.
 */
class TeacherDashboard {
    constructor() {
        this.db = db; // Firestore instance
        this.currentClassId = null;
        this.students = [];
        this.missions = {}; // Store mission data for context
        this.charts = {}; // To hold Chart.js instances

        // DOM element references
        this.views = {
            overview: document.getElementById('overview-view'),
            studentList: document.getElementById('student-list-view'),
            knowledgeGaps: document.getElementById('knowledge-gaps-view'), // Add this
            reports: document.getElementById('reports-view')
        };
        this.navItems = document.querySelectorAll('.nav-item');
        this.classSelector = document.getElementById('class-selector');
    }

    async init() {
        try {
            // Load missions data
            await this.loadMissions();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial class data
            await this.loadClasses();
            
            // Initialize charts
            this.initializeCharts();
            
            // Set up navigation
            this.setupNavigation();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to load dashboard. Please refresh the page.');
        }
    }

    async loadMissions() {
        try {
            const db = firebase.firestore();
            const missionsDoc = await db.collection('missions').doc('current').get();
            
            if (missionsDoc.exists) {
                this.missions = missionsDoc.data();
            } else {
                // Fallback to local missions.json
                const response = await fetch('missions.json');
                this.missions = await response.json();
            }
        } catch (error) {
            console.error('Failed to load missions:', error);
            throw new Error('Could not load mission data');
        }
    }

    async loadClasses() {
        try {
            const db = firebase.firestore();
            const classesSnapshot = await db.collection('classes').get();
            
            const classSelect = document.getElementById('class-select');
            classSelect.innerHTML = '<option value="">Select Class</option>';
            
            classesSnapshot.forEach(doc => {
                const classData = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = classData.name;
                classSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load classes:', error);
            this.showError('Failed to load class list');
        }
    }

    setupEventListeners() {
        // Class selection change
        document.getElementById('class-select').addEventListener('change', (e) => {
            this.loadClassData(e.target.value);
        });

        // Navigation menu clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchView(item.dataset.view);
            });
        });

        this.classSelector.addEventListener('change', () => {
            this.currentClassId = this.classSelector.value;
            this.fetchDataAndRender();
        });
    }

    async loadClassData(classId) {
        if (!classId) return;

        this.showLoading();
        try {
            const db = firebase.firestore();
            
            // Load class details
            const classDoc = await db.collection('classes').doc(classId).get();
            this.currentClass = { id: classDoc.id, ...classDoc.data() };

            // Load students in class
            const studentsSnapshot = await db.collection('students')
                .where('classId', '==', classId)
                .get();

            this.students = [];
            const progressPromises = [];

            studentsSnapshot.forEach(doc => {
                const student = { id: doc.id, ...doc.data() };
                this.students.push(student);
                
                // Queue progress data loading
                progressPromises.push(
                    db.collection('studentProgress')
                        .doc(student.id)
                        .get()
                        .then(progressDoc => {
                            if (progressDoc.exists) {
                                student.progress = progressDoc.data();
                            }
                        })
                );
            });

            // Wait for all progress data to load
            await Promise.all(progressPromises);

            // Update dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('Failed to load class data:', error);
            this.showError('Failed to load class data');
        } finally {
            this.hideLoading();
        }
    }

    async fetchDataAndRender() {
        if (!this.currentClassId) return;

        // 1. Fetch all student profiles for the selected class
        const studentsSnapshot = await this.db.collection('studentProfiles')
            .where('classId', '==', this.currentClassId).get();
        
        this.students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Fetch all progress data for all students in the class
        // This is a more complex query, fetching from a subcollection for each student.
        const progressPromises = this.students.map(student =>
            this.db.collection('studentProgress').doc(student.id)
                .collection('missions').get()
        );
        
        const progressSnapshots = await Promise.all(progressPromises);

        // 3. Attach the progress data to each student object
        this.students.forEach((student, index) => {
            student.missions = progressSnapshots[index].docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        // 4. Process the data and update the UI
        this.updateDashboard();
    }

    updateDashboard() {
        this.updateMetrics();
        this.updateCharts();
        this.renderStudentList();
        this.analyzeAndRenderKnowledgeGaps(); // Add this call
    }

    updateMetrics() {
        if (!this.students.length) return;

        // Calculate metrics
        const metrics = this.calculateClassMetrics();

        // Update metric cards
        document.querySelector('.metric-card:nth-child(1) .metric-value')
            .textContent = `${metrics.averagePerformance}%`;
        document.querySelector('.metric-card:nth-child(2) .metric-value')
            .textContent = `${metrics.activeStudents}/${this.students.length}`;
        document.querySelector('.metric-card:nth-child(3) .metric-value')
            .textContent = metrics.totalMissionsCompleted;
        document.querySelector('.metric-card:nth-child(4) .metric-value')
            .textContent = `${metrics.averageTimeSpent}h`;
    }

    calculateClassMetrics() {
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const metrics = {
            totalScore: 0,
            activeStudents: 0,
            totalMissions: 0,
            totalTime: 0
        };

        this.students.forEach(student => {
            if (!student.progress) return;

            // Calculate average performance
            metrics.totalScore += student.progress.averageScore || 0;

            // Count active students (active in last week)
            if (new Date(student.progress.lastActive) > oneWeekAgo) {
                metrics.activeStudents++;
            }

            // Count completed missions
            metrics.totalMissions += student.progress.completedMissions || 0;

            // Sum up time spent
            metrics.totalTime += student.progress.timeSpent || 0;
        });

        return {
            averagePerformance: Math.round(metrics.totalScore / this.students.length),
            activeStudents: metrics.activeStudents,
            totalMissionsCompleted: metrics.totalMissions,
            averageTimeSpent: (metrics.totalTime / this.students.length / 3600).toFixed(1) // Convert seconds to hours
        };
    }

    updateCharts() {
        if (!this.charts.subjectPerformance) return;

        // --- Aggregate data for the Subject Performance chart ---
        const subjectScores = {}; // e.g., { Science: [80, 95], Math: [70] }

        this.students.forEach(student => {
            student.missions.forEach(missionProgress => {
                // We need to know which subject each mission belongs to.
                // This requires loading missions.json or having subject info in the progress data.
                // For now, let's assume a 'subject' field exists in the progress data.
                const subject = missionProgress.subject || 'General';
                if (!subjectScores[subject]) {
                    subjectScores[subject] = [];
                }
                subjectScores[subject].push(missionProgress.score || 0);
            });
        });

        // --- Calculate the average for each subject ---
        const chartLabels = Object.keys(subjectScores);
        const chartData = chartLabels.map(subject => {
            const scores = subjectScores[subject];
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        });

        // --- Update the Chart.js instance ---
        this.charts.subjectPerformance.data.labels = chartLabels;
        this.charts.subjectPerformance.data.datasets[0].data = chartData;
        this.charts.subjectPerformance.update();
    }

    analyzeAndRenderKnowledgeGaps() {
        const container = document.getElementById('knowledge-gaps-container');
        container.innerHTML = ''; // Clear previous results

        // This analysis requires detailed quiz results, including which specific questions were answered incorrectly.
        // We will assume the 'studentProgress' documents contain a 'quizAttempts' collection.
        // For this example, we'll simulate this data structure based on the scores.

        const incorrectAnswers = {}; // Format: { 'missionId_questionIndex': { question: '...', count: 0 } }

        // This is a simplified simulation. A real implementation would fetch detailed answer data.
        this.students.forEach(student => {
            student.missions.forEach(mission => {
                if (mission.score < 80) { // Assume missions with low scores indicate knowledge gaps
                    const missionDetails = this.getMissionDetails(mission.id);
                    if (missionDetails && missionDetails.conquer) {
                        missionDetails.conquer.forEach((question, index) => {
                            // Simulate that a random question was answered incorrectly
                            const questionId = `${mission.id}_${index}`;
                            if (!incorrectAnswers[questionId]) {
                                incorrectAnswers[questionId] = {
                                    question: question.question,
                                    count: 0,
                                    mission: missionDetails.title
                                };
                            }
                            incorrectAnswers[questionId].count++;
                        });
                    }
                }
            });
        });

        const sortedGaps = Object.values(incorrectAnswers).sort((a, b) => b.count - a.count);

        if (sortedGaps.length === 0) {
            container.innerHTML = '<p>No significant knowledge gaps identified. Great work!</p>';
            return;
        }

        // Render the top 5 knowledge gaps
        sortedGaps.slice(0, 5).forEach(gap => {
            const element = document.createElement('div');
            element.className = 'knowledge-gap-item';
            element.innerHTML = `
                <strong>Mission: ${gap.mission}</strong>
                <p>"${gap.question}"</p>
                <span>- Incorrectly answered ${gap.count} times across the class.</span>
            `;
            container.appendChild(element);
        });
    }

    // Helper to get mission details from the loaded missions data
    getMissionDetails(missionId) {
        for (const subjectKey in this.missions.subjects) {
            const subject = this.missions.subjects[subjectKey];
            const mission = subject.missions.find(m => m.id === missionId);
            if (mission) return mission;
        }
        return null;
    }

    initializeCharts() {
        const ctx = document.getElementById('subject-performance-chart').getContext('2d');
        this.charts.subjectPerformance = new Chart(ctx, {
            type: 'bar', // Bar chart is often clearer for subject comparison
            data: {
                labels: [], // Will be populated with subject names
                datasets: [{
                    label: 'Class Average Score',
                    data: [], // Will be populated with average scores
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        );
    }

    renderStudentList() {
        const tbody = document.getElementById('student-list-body');
        tbody.innerHTML = '';

        this.students.sort((a, b) => 
            (b.progress?.averageScore || 0) - (a.progress?.averageScore || 0)
        ).forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.name}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${student.progress?.progress || 0}%"></div>
                    </div>
                </td>
                <td>${this.formatLastActive(student.progress?.lastActive)}</td>
                <td>${student.progress?.averageScore || 0}%</td>
                <td>
                    <button class="action-btn" onclick="teacherDashboard.viewStudentDetails('${student.id}')">
                        View Details
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async viewStudentDetails(studentId) {
        this.showLoading();
        try {
            const student = this.students.find(s => s.id === studentId);
            if (!student) return;

            // Load detailed progress data
            const db = firebase.firestore();
            const progressSnapshot = await db.collection('studentProgress')
                .doc(studentId)
                .collection('details')
                .get();

            const details = [];
            progressSnapshot.forEach(doc => {
                details.push(doc.data());
            });

            // Switch to student details view
            this.switchView('students');
            this.renderStudentDetails(student, details);
        } catch (error) {
            console.error('Failed to load student details:', error);
            this.showError('Failed to load student details');
        } finally {
            this.hideLoading();
        }
    }

    renderStudentDetails(student, details) {
        const container = document.querySelector('.student-progress-content');
        container.innerHTML = `
            <div class="student-header">
                <h3>${student.name}</h3>
                <p>Class: ${this.currentClass.name}</p>
            </div>
            
            <div class="performance-overview">
                <div class="metric-card">
                    <div class="metric-title">Overall Progress</div>
                    <div class="metric-value">${student.progress?.progress || 0}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Average Score</div>
                    <div class="metric-value">${student.progress?.averageScore || 0}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Missions Completed</div>
                    <div class="metric-value">${student.progress?.completedMissions || 0}</div>
                </div>
            </div>

            <div class="subject-breakdown">
                <h4>Subject Performance</h4>
                ${this.renderSubjectBreakdown(student.progress?.subjects || {})}
            </div>

            <div class="recent-activity">
                <h4>Recent Activity</h4>
                ${this.renderRecentActivity(details)}
            </div>

            <div class="knowledge-gaps">
                <h4>Identified Knowledge Gaps</h4>
                ${this.renderKnowledgeGaps(student.progress?.gaps || [])}
            </div>
        `;
    }

    renderSubjectBreakdown(subjects) {
        return Object.entries(subjects).map(([subject, data]) => `
            <div class="subject-card">
                <h5>${subject}</h5>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${data.score || 0}%"></div>
                </div>
                <p>Score: ${data.score || 0}%</p>
                <p>Completed: ${data.completed || 0} missions</p>
            </div>
        `).join('');
    }

    renderRecentActivity(details) {
        return details.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        ).slice(0, 5).map(activity => `
            <div class="activity-item">
                <div class="activity-time">${this.formatDate(activity.timestamp)}</div>
                <div class="activity-description">
                    Completed ${activity.missionName} with score ${activity.score}%
                </div>
            </div>
        `).join('');
    }

    renderKnowledgeGaps(gaps) {
        if (!gaps.length) {
            return '<p>No significant knowledge gaps identified.</p>';
        }

        return gaps.map(gap => `
            <div class="gap-item">
                <div class="gap-subject">${gap.subject}</div>
                <div class="gap-description">${gap.description}</div>
                <div class="gap-recommendation">
                    Recommended: ${gap.recommendation}
                </div>
            </div>
        `).join('');
    }

    async generateReport() {
        const reportType = document.getElementById('report-type').value;
        const timePeriod = document.getElementById('time-period').value;

        this.showLoading();
        try {
            const reportData = await this.fetchReportData(reportType, timePeriod);
            this.renderReport(reportData, reportType, timePeriod);
        } catch (error) {
            console.error('Failed to generate report:', error);
            this.showError('Failed to generate report');
        } finally {
            this.hideLoading();
        }
    }

    async fetchReportData(reportType, timePeriod) {
        const db = firebase.firestore();
        const startDate = this.getStartDate(timePeriod);
        
        try {
            switch (reportType) {
                case 'class':
                    return await this.fetchClassReport(startDate);
                case 'individual':
                    return await this.fetchIndividualReports(startDate);
                case 'subject':
                    return await this.fetchSubjectReport(startDate);
                default:
                    throw new Error('Invalid report type');
            }
        } catch (error) {
            console.error('Error fetching report data:', error);
            throw error;
        }
    }

    async fetchClassReport(startDate) {
        const db = firebase.firestore();
        
        const snapshot = await db.collection('studentProgress')
            .where('classId', '==', this.currentClass.id)
            .where('timestamp', '>=', startDate)
            .get();

        const data = {
            totalStudents: this.students.length,
            activeStudents: 0,
            averageScore: 0,
            completedMissions: 0,
            subjectPerformance: {},
            dailyActivity: {}
        };

        snapshot.forEach(doc => {
            const progress = doc.data();
            data.activeStudents++;
            data.averageScore += progress.averageScore || 0;
            data.completedMissions += progress.completedMissions || 0;
            
            // Aggregate subject performance
            if (progress.subjects) {
                Object.entries(progress.subjects).forEach(([subject, performance]) => {
                    if (!data.subjectPerformance[subject]) {
                        data.subjectPerformance[subject] = {
                            totalScore: 0,
                            count: 0
                        };
                    }
                    data.subjectPerformance[subject].totalScore += performance.score || 0;
                    data.subjectPerformance[subject].count++;
                });
            }

            // Aggregate daily activity
            if (progress.dailyActivity) {
                Object.entries(progress.dailyActivity).forEach(([date, count]) => {
                    data.dailyActivity[date] = (data.dailyActivity[date] || 0) + count;
                });
            }
        });

        // Calculate averages
        data.averageScore = data.activeStudents ? 
            Math.round(data.averageScore / data.activeStudents) : 0;

        Object.keys(data.subjectPerformance).forEach(subject => {
            const subjectData = data.subjectPerformance[subject];
            data.subjectPerformance[subject] = Math.round(
                subjectData.totalScore / subjectData.count
            );
        });

        return data;
    }

    renderReport(data, type, timePeriod) {
        const container = document.getElementById('report-content');
        
        switch (type) {
            case 'class':
                this.renderClassReport(container, data, timePeriod);
                break;
            case 'individual':
                this.renderIndividualReport(container, data, timePeriod);
                break;
            case 'subject':
                this.renderSubjectReport(container, data, timePeriod);
                break;
        }
    }

    renderClassReport(container, data, timePeriod) {
        container.innerHTML = `
            <div class="report-header">
                <h3>Class Performance Report</h3>
                <p>Period: ${this.formatTimePeriod(timePeriod)}</p>
            </div>

            <div class="report-summary">
                <div class="summary-metrics">
                    <div class="metric-card">
                        <div class="metric-title">Class Average</div>
                        <div class="metric-value">${data.averageScore}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Active Students</div>
                        <div class="metric-value">${data.activeStudents}/${data.totalStudents}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Completed Missions</div>
                        <div class="metric-value">${data.completedMissions}</div>
                    </div>
                </div>

                <div class="subject-performance">
                    <h4>Subject Performance</h4>
                    ${Object.entries(data.subjectPerformance).map(([subject, score]) => `
                        <div class="subject-row">
                            <span>${subject}</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${score}%"></div>
                            </div>
                            <span>${score}%</span>
                        </div>
                    `).join('')}
                </div>

                <div class="daily-activity">
                    <h4>Daily Activity</h4>
                    <canvas id="daily-activity-chart"></canvas>
                </div>
            </div>

            <div class="report-actions">
                <button class="action-btn" onclick="teacherDashboard.downloadReport()">
                    Download Report
                </button>
            </div>
        `;

        // Initialize daily activity chart
        const ctx = document.getElementById('daily-activity-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.dailyActivity),
                datasets: [{
                    label: 'Activity Count',
                    data: Object.values(data.dailyActivity),
                    backgroundColor: 'rgba(39, 174, 96, 0.6)'
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    downloadReport() {
        // Implementation for report download
        // Could generate PDF or Excel file
        alert('Report download functionality will be implemented here');
    }

    switchView(view) {
        // Hide all sections
        document.querySelectorAll('.main-content > div').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        document.getElementById(`${view}-section`).style.display = 'block';

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        this.currentView = view;
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatLastActive(timestamp) {
        if (!timestamp) return 'Never';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 24 * 60 * 60 * 1000) {
            return 'Today';
        } else if (diff < 48 * 60 * 60 * 1000) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    }

    formatTimePeriod(period) {
        const now = new Date();
        switch (period) {
            case 'week':
                return `${this.formatDate(now.setDate(now.getDate() - 7))} - ${this.formatDate(new Date())}`;
            case 'month':
                return `${this.formatDate(now.setMonth(now.getMonth() - 1))} - ${this.formatDate(new Date())}`;
            case 'quarter':
                return `${this.formatDate(now.setMonth(now.getMonth() - 3))} - ${this.formatDate(new Date())}`;
            default:
                return '';
        }
    }

    showLoading() {
        document.querySelector('.loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.querySelector('.loading-overlay').style.display = 'none';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Export the TeacherDashboard class
export { TeacherDashboard };
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize dashboard
const teacherDashboard = new TeacherDashboard();