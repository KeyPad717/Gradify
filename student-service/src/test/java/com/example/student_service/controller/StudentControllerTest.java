package com.example.student_service.controller;

import com.example.student_service.model.EnrolledCourse;
import com.example.student_service.model.GradeDistribution;
import com.example.student_service.model.StudentRanking;
import com.example.student_service.service.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StudentController.class)
class StudentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudentService studentService;

    @Test
    void getEnrolledCourses_shouldReturnList() throws Exception {
        when(studentService.getEnrolledCourses("student@test.com"))
                .thenReturn(List.of(new EnrolledCourse(1, "CS101", "Intro", "prof1", "2024-01-01")));

        mockMvc.perform(get("/api/student/courses?email=student@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].course_code").value("CS101"));
    }

    @Test
    void getEnrolledCourses_returnsEmpty_whenNone() throws Exception {
        when(studentService.getEnrolledCourses("none@test.com"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/student/courses?email=none@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getCourseRankings_shouldReturnList() throws Exception {
        when(studentService.getCourseRankings(1, "student@test.com"))
                .thenReturn(List.of(
                        new StudentRanking(1, "s1", "Alice", "alice@test.com", null, 85.0, 100, "A", false),
                        new StudentRanking(2, "s2", "Bob", "bob@test.com", null, 75.0, 100, "B", false)
                ));

        mockMvc.perform(get("/api/student/courses/1/rankings?email=student@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].rank").value(1))
                .andExpect(jsonPath("$[0].student_name").value("Alice"))
                .andExpect(jsonPath("$[1].rank").value(2))
                .andExpect(jsonPath("$[1].student_name").value("Bob"));
    }

    @Test
    void getCourseRankings_returnsEmpty_whenNoStudents() throws Exception {
        when(studentService.getCourseRankings(1, "student@test.com"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/student/courses/1/rankings?email=student@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getGradeDistribution_shouldReturnList() throws Exception {
        when(studentService.getGradeDistribution(1))
                .thenReturn(List.of(new GradeDistribution(1, 1, "A", 20, null)));

        mockMvc.perform(get("/api/student/courses/1/grade-distribution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].grade").value("A"))
                .andExpect(jsonPath("$[0].percentage").value(20));
    }

    @Test
    void getGradeDistribution_returnsEmpty_whenNone() throws Exception {
        when(studentService.getGradeDistribution(1))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/student/courses/1/grade-distribution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getCGPA_shouldReturnValue() throws Exception {
        when(studentService.getStudentCGPA("student@test.com"))
                .thenReturn(3.5);

        mockMvc.perform(get("/api/student/cgpa?email=student@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(3.5));
    }

    @Test
    void getCGPA_returnsZero_whenNoCourses() throws Exception {
        when(studentService.getStudentCGPA("new@test.com"))
                .thenReturn(0.0);

        mockMvc.perform(get("/api/student/cgpa?email=new@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(0.0));
    }
}