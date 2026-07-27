package com.example.professor_service.controller;

import com.example.professor_service.model.Course;
import com.example.professor_service.model.EvaluationComponent;
import com.example.professor_service.model.GradeDistribution;
import com.example.professor_service.model.Mark;
import com.example.professor_service.model.StudentDTO;
import com.example.professor_service.service.ProfessorService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/professor")
public class ProfessorController {

    private final ProfessorService professorService;

    public ProfessorController(ProfessorService professorService) {
        this.professorService = professorService;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleValidationError(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "validation_failed", "message", e.getMessage()));
    }

    @GetMapping("/courses")
    public List<Course> getCourses(@RequestParam String professorId) {
        return professorService.getCoursesByProfessor(professorId);
    }

    @GetMapping("/courses/{courseId}/students")
    public List<StudentDTO> getStudents(@PathVariable Integer courseId) {
        return professorService.getEnrolledStudents(courseId);
    }

    @GetMapping("/courses/{courseId}")
    public Course getCourse(@PathVariable Integer courseId) {
        return professorService.getCourseByCourseId(courseId);
    }

    @GetMapping("/courses/{courseId}/components")
    public List<EvaluationComponent> getComponents(@PathVariable Integer courseId) {
        return professorService.getEvaluationComponents(courseId);
    }

    @PostMapping("/courses/{courseId}/components")
    public EvaluationComponent addComponent(@PathVariable Integer courseId, @RequestBody EvaluationComponent component) {
        component.setCourseId(courseId);
        return professorService.addEvaluationComponent(component);
    }

    @PutMapping("/components/{componentId}")
    public EvaluationComponent updateComponent(@PathVariable Integer componentId, @RequestBody EvaluationComponent component) {
        return professorService.updateEvaluationComponent(componentId, component);
    }

    @DeleteMapping("/components/{componentId}")
    public void deleteComponent(@PathVariable Integer componentId) {
        professorService.deleteEvaluationComponent(componentId);
    }

    @GetMapping("/components/{componentId}/marks")
    public List<Mark> getMarks(@PathVariable Integer componentId) {
        return professorService.getMarksByComponent(componentId);
    }

    @PostMapping("/marks/bulk")
    public List<Mark> saveMarks(@RequestBody List<Mark> marks) {
        return professorService.saveMarksBulk(marks);
    }

    @GetMapping("/courses/{courseId}/marks/all")
    public List<Mark> getCourseMarks(@PathVariable Integer courseId) {
        return professorService.getMarksByCourse(courseId);
    }

    @PostMapping("/courses/{courseId}/components/bulk")
    public List<EvaluationComponent> saveComponentsBulk(@PathVariable Integer courseId, @RequestBody List<EvaluationComponent> components) {
        components.forEach(c -> c.setCourseId(courseId));
        return professorService.saveEvaluationComponentsBulk(components);
    }

    @GetMapping("/courses/{courseId}/grade-distribution")
    public List<GradeDistribution> getGradeDistribution(@PathVariable Integer courseId) {
        return professorService.getGradeDistribution(courseId);
    }

    @PostMapping("/courses/{courseId}/grade-distribution")
    public List<GradeDistribution> saveGradeDistribution(@PathVariable Integer courseId, @RequestBody List<GradeDistribution> distributions) {
        distributions.forEach(d -> d.setCourseId(courseId));
        return professorService.saveGradeDistributionBulk(distributions);
    }
}
