package com.example.student_service.controller;

import com.example.student_service.model.EnrolledCourse;
import com.example.student_service.model.GradeDistribution;
import com.example.student_service.model.StudentRanking;
import com.example.student_service.service.StudentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    /** GET /api/student/courses — identity comes from the X-User-Email header set by api-gateway */
    @GetMapping("/courses")
    public ResponseEntity<List<EnrolledCourse>> getEnrolledCourses(
            @RequestHeader(value = "X-User-Email", required = false) String authenticatedEmail) {
        if (authenticatedEmail == null || authenticatedEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(studentService.getEnrolledCourses(authenticatedEmail));
    }

    /**
     * GET /api/student/courses/{courseId}/rankings
     * Returns all students ranked by total marks; flags the requesting student.
     */
    @GetMapping("/courses/{courseId}/rankings")
    public ResponseEntity<List<StudentRanking>> getCourseRankings(
            @PathVariable Integer courseId,
            @RequestHeader(value = "X-User-Email", required = false) String authenticatedEmail) {
        if (authenticatedEmail == null || authenticatedEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(studentService.getCourseRankings(courseId, authenticatedEmail));
    }

    @GetMapping("/courses/{courseId}/grade-distribution")
    public List<GradeDistribution> getGradeDistribution(@PathVariable Integer courseId) {
        return studentService.getGradeDistribution(courseId);
    }

    @GetMapping("/cgpa")
    public ResponseEntity<Double> getStudentCGPA(
            @RequestHeader(value = "X-User-Email", required = false) String authenticatedEmail) {
        if (authenticatedEmail == null || authenticatedEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(studentService.getStudentCGPA(authenticatedEmail));
    }
}
