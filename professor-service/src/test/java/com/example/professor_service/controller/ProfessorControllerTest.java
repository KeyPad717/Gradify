package com.example.professor_service.controller;

import com.example.professor_service.model.Course;
import com.example.professor_service.model.EvaluationComponent;
import com.example.professor_service.model.GradeDistribution;
import com.example.professor_service.model.Mark;
import com.example.professor_service.model.StudentDTO;
import com.example.professor_service.service.ProfessorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProfessorController.class)
class ProfessorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProfessorService professorService;

    @Test
    void getCourses_shouldReturnList() throws Exception {
        when(professorService.getCoursesByProfessor("prof1"))
                .thenReturn(List.of(new Course(1, "CS101", "Intro", "prof1", "2024-01-01")));

        mockMvc.perform(get("/api/professor/courses?professorId=prof1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].course_code").value("CS101"));
    }

    @Test
    void getCourses_returnsEmpty_whenNoneFound() throws Exception {
        when(professorService.getCoursesByProfessor("prof_none"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/professor/courses?professorId=prof_none"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getStudents_shouldReturnList() throws Exception {
        when(professorService.getEnrolledStudents(1))
                .thenReturn(List.of(new StudentDTO("s1", "Alice", "alice@test.com")));

        mockMvc.perform(get("/api/professor/courses/1/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentId").value("s1"))
                .andExpect(jsonPath("$[0].name").value("Alice"));
    }

    @Test
    void getCourse_shouldReturnCourse() throws Exception {
        when(professorService.getCourseByCourseId(1))
                .thenReturn(new Course(1, "CS101", "Intro", "prof1", "2024-01-01"));

        mockMvc.perform(get("/api/professor/courses/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.course_code").value("CS101"));
    }

    @Test
    void getComponents_shouldReturnList() throws Exception {
        when(professorService.getEvaluationComponents(1))
                .thenReturn(List.of(new EvaluationComponent(1, 1, "Midterm", 40, 100, "2024-01-01")));

        mockMvc.perform(get("/api/professor/courses/1/components"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].component_name").value("Midterm"));
    }

    @Test
    void addComponent_shouldReturnCreated() throws Exception {
        EvaluationComponent input = new EvaluationComponent(null, 1, "Final", 60, 100, null);
        EvaluationComponent output = new EvaluationComponent(2, 1, "Final", 60, 100, "2024-01-01");

        when(professorService.addEvaluationComponent(any(EvaluationComponent.class)))
                .thenReturn(output);

        mockMvc.perform(post("/api/professor/courses/1/components")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"component_name": "Final", "weightage": 60, "max_marks": 100}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.component_name").value("Final"))
                .andExpect(jsonPath("$.id").value(2));
    }

    @Test
    void updateComponent_shouldReturnUpdated() throws Exception {
        EvaluationComponent updated = new EvaluationComponent(1, 1, "Midterm Updated", 50, 100, "2024-01-01");
        when(professorService.updateEvaluationComponent(eq(1), any(EvaluationComponent.class)))
                .thenReturn(updated);

        mockMvc.perform(put("/api/professor/components/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"component_name": "Midterm Updated", "weightage": 50, "max_marks": 100}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.component_name").value("Midterm Updated"));
    }

    @Test
    void deleteComponent_shouldReturnOk() throws Exception {
        mockMvc.perform(delete("/api/professor/components/1"))
                .andExpect(status().isOk());
    }

    @Test
    void getMarks_shouldReturnList() throws Exception {
        when(professorService.getMarksByComponent(1))
                .thenReturn(List.of(new Mark(1, "s1", 1, 1, 85.0, null)));

        mockMvc.perform(get("/api/professor/components/1/marks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].student_id").value("s1"))
                .andExpect(jsonPath("$[0].marks_obtained").value(85.0));
    }

    @Test
    void saveMarksBulk_shouldReturnSaved() throws Exception {
        when(professorService.saveMarksBulk(anyList()))
                .thenReturn(List.of(new Mark(1, "s1", 1, 1, 85.0, null)));

        mockMvc.perform(post("/api/professor/marks/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"student_id": "s1", "course_id": 1, "component_id": 1, "marks_obtained": 85}]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].marks_obtained").value(85.0));
    }

    @Test
    void getCourseMarks_shouldReturnList() throws Exception {
        when(professorService.getMarksByCourse(1))
                .thenReturn(List.of(new Mark(1, "s1", 1, 1, 90.0, null)));

        mockMvc.perform(get("/api/professor/courses/1/marks/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].marks_obtained").value(90.0));
    }

    @Test
    void saveComponentsBulk_shouldReturnSaved() throws Exception {
        when(professorService.saveEvaluationComponentsBulk(anyList()))
                .thenReturn(List.of(new EvaluationComponent(1, 1, "Midterm", 40, 100, null)));

        mockMvc.perform(post("/api/professor/courses/1/components/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"component_name": "Midterm", "weightage": 40, "max_marks": 100}]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].component_name").value("Midterm"));
    }

    @Test
    void getGradeDistribution_shouldReturnList() throws Exception {
        when(professorService.getGradeDistribution(1))
                .thenReturn(List.of(new GradeDistribution(1, 1, "A", 20, null)));

        mockMvc.perform(get("/api/professor/courses/1/grade-distribution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].grade").value("A"));
    }

    @Test
    void saveGradeDistribution_shouldReturnSaved() throws Exception {
        when(professorService.saveGradeDistributionBulk(anyList()))
                .thenReturn(List.of(new GradeDistribution(1, 1, "A", 20, null)));

        mockMvc.perform(post("/api/professor/courses/1/grade-distribution")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"grade": "A", "percentage": 20}]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].grade").value("A"));
    }

    @Test
    void validationError_shouldReturn400() throws Exception {
        when(professorService.addEvaluationComponent(any(EvaluationComponent.class)))
                .thenThrow(new IllegalArgumentException("Total weightage would exceed 100%"));

        mockMvc.perform(post("/api/professor/courses/1/components")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"component_name": "Too Much", "weightage": 200, "max_marks": 100}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("validation_failed"));
    }
}