package com.example.professor_service.service;

import com.example.professor_service.model.Course;
import com.example.professor_service.model.EvaluationComponent;
import com.example.professor_service.model.GradeDistribution;
import com.example.professor_service.model.Mark;
import com.example.professor_service.model.StudentDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class ProfessorService {

    private final RestTemplate restTemplate;

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service_role.key:}")
    private String supabaseServiceRoleKey;

    public ProfessorService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<Course> getCoursesByProfessor(String professorId) {
        String url = supabaseUrl + "/rest/v1/courses?professor_id=eq." + professorId + "&select=*";

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseAnonKey);
        headers.set("Authorization", "Bearer " + supabaseAnonKey);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<Course[]> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                Course[].class
        );

        if (response.getBody() != null) {
            return Arrays.asList(response.getBody());
        }
        return List.of();
    }

    public List<StudentDTO> getEnrolledStudents(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/enrollments?course_id=eq." + courseId + "&select=student:users(id,name,email)";

        // Use service_role key if provided to bypass RLS, fallback to anon key
        String key = (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) 
                     ? supabaseServiceRoleKey 
                     : supabaseAnonKey;

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Map[].class
            );

            if (response.getBody() != null) {
                return Arrays.stream(response.getBody())
                        .map(item -> {
                            Map<String, String> studentMap = (Map<String, String>) item.get("student");
                            return new StudentDTO(studentMap.get("id"), studentMap.get("name"), studentMap.get("email"));
                        })
                        .collect(Collectors.toList());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (GET Students): " + e.getResponseBodyAsString());
        }
        return List.of();
    }

    public Course getCourseByCourseId(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/courses?id=eq." + courseId + "&select=*";

        String key = (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) 
                     ? supabaseServiceRoleKey 
                     : supabaseAnonKey;

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<Course[]> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                Course[].class
        );

        if (response.getBody() != null && response.getBody().length > 0) {
            return response.getBody()[0];
        }
        return null;
    }

    public List<EvaluationComponent> getEvaluationComponents(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/evaluation_components?course_id=eq." + courseId + "&select=*&order=created_at.asc";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<EvaluationComponent[]> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                EvaluationComponent[].class
        );

        if (response.getBody() != null) {
            return Arrays.asList(response.getBody());
        }
        return List.of();
    }

    public EvaluationComponent addEvaluationComponent(EvaluationComponent component) {
        Integer courseId = component.getCourseId();
        if (courseId != null && component.getWeightage() != null) {
            validateWeightageTotal(courseId, component.getWeightage(), null);
        }

        String url = supabaseUrl + "/rest/v1/evaluation_components";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.set("Prefer", "return=representation");

        HttpEntity<EvaluationComponent> entity = new HttpEntity<>(component, headers);

        try {
            ResponseEntity<EvaluationComponent[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    EvaluationComponent[].class
            );

            if (response.getBody() != null && response.getBody().length > 0) {
                return response.getBody()[0];
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (POST): " + e.getResponseBodyAsString());
            throw e;
        }
        return null;
    }

    public EvaluationComponent updateEvaluationComponent(Integer componentId, EvaluationComponent component) {
        String url = supabaseUrl + "/rest/v1/evaluation_components?id=eq." + componentId;
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.set("Prefer", "return=representation");

        HttpEntity<EvaluationComponent> entity = new HttpEntity<>(component, headers);

        try {
            ResponseEntity<EvaluationComponent[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    entity,
                    EvaluationComponent[].class
            );

            if (response.getBody() != null && response.getBody().length > 0) {
                return response.getBody()[0];
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (PATCH): " + e.getResponseBodyAsString());
            throw e;
        }
        return null;
    }

    public void deleteEvaluationComponent(Integer componentId) {
        String url = supabaseUrl + "/rest/v1/evaluation_components?id=eq." + componentId;
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    entity,
                    Void.class
            );
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (DELETE): " + e.getResponseBodyAsString());
            throw e;
        }
    }

    public List<Mark> getMarksByComponent(Integer componentId) {
        String url = supabaseUrl + "/rest/v1/marks?component_id=eq." + componentId + "&select=*";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Mark[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Mark[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (GET Marks): " + e.getResponseBodyAsString());
        }
        return List.of();
    }

    public List<Mark> saveMarksBulk(List<Mark> marks) {
        String url = supabaseUrl + "/rest/v1/marks?on_conflict=student_id,course_id,component_id";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        // resolution=merge-duplicates acts as UPSERT in Supabase/PostgREST
        headers.set("Prefer", "return=representation,resolution=merge-duplicates");

        HttpEntity<List<Mark>> entity = new HttpEntity<>(marks, headers);

        try {
            ResponseEntity<Mark[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    Mark[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (BULK POST Marks): " + e.getResponseBodyAsString());
            throw e;
        }
        return List.of();
    }

    public List<Mark> getMarksByCourse(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/marks?course_id=eq." + courseId + "&select=*";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Mark[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    Mark[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (GET Course Marks): " + e.getResponseBodyAsString());
        }
        return List.of();
    }

    public List<EvaluationComponent> saveEvaluationComponentsBulk(List<EvaluationComponent> components) {
        if (!components.isEmpty()) {
            Integer courseId = components.get(0).getCourseId();
            if (courseId != null) {
                int addSum = components.stream()
                    .filter(c -> c.getWeightage() != null)
                    .mapToInt(EvaluationComponent::getWeightage)
                    .sum();
                validateWeightageTotal(courseId, addSum, null);
            }
        }

        String url = supabaseUrl + "/rest/v1/evaluation_components";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.set("Prefer", "return=representation,resolution=merge-duplicates");

        HttpEntity<List<EvaluationComponent>> entity = new HttpEntity<>(components, headers);

        try {
            ResponseEntity<EvaluationComponent[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    EvaluationComponent[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (BULK POST Components): " + e.getResponseBodyAsString());
            throw e;
        }
        return List.of();
    }

    public List<GradeDistribution> getGradeDistribution(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/grade_distribution?course_id=eq." + courseId + "&select=*";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<GradeDistribution[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    GradeDistribution[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (GET Grade Distribution): " + e.getResponseBodyAsString());
        }
        return List.of();
    }

    public void deleteGradeDistributionForCourse(Integer courseId) {
        String url = supabaseUrl + "/rest/v1/grade_distribution?course_id=eq." + courseId;
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    entity,
                    Void.class
            );
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (DELETE Grade Distribution): " + e.getResponseBodyAsString());
        }
    }

    public List<GradeDistribution> saveGradeDistributionBulk(List<GradeDistribution> distributions) {
        if (distributions.isEmpty()) return List.of();
        
        Integer courseId = distributions.get(0).getCourseId();
        
        // First, clear existing distribution for this course
        deleteGradeDistributionForCourse(courseId);

        // Then insert new ones
        String url = supabaseUrl + "/rest/v1/grade_distribution";
        String key = getEffectiveKey();

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.set("Prefer", "return=representation");

        HttpEntity<List<GradeDistribution>> entity = new HttpEntity<>(distributions, headers);

        try {
            ResponseEntity<GradeDistribution[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    GradeDistribution[].class
            );

            if (response.getBody() != null) {
                return Arrays.asList(response.getBody());
            }
        } catch (HttpStatusCodeException e) {
            System.err.println("Supabase Error (BULK POST Grade Distribution): " + e.getResponseBodyAsString());
            throw e;
        }
        return List.of();
    }

    private String getEffectiveKey() {
        return (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) 
               ? supabaseServiceRoleKey 
               : supabaseAnonKey;
    }

    private void validateWeightageTotal(Integer courseId, Integer addWeightage, Integer excludeComponentId) {
        List<EvaluationComponent> existing = getEvaluationComponents(courseId);
        int existingSum = 0;
        for (EvaluationComponent c : existing) {
            if (c.getWeightage() != null && !Objects.equals(c.getId(), excludeComponentId)) {
                existingSum += c.getWeightage();
            }
        }
        int total = existingSum + (addWeightage != null ? addWeightage : 0);
        if (total > 100) {
            throw new IllegalArgumentException(
                "Total weightage would exceed 100% (currently " + existingSum +
                "%, adding " + addWeightage + "% = " + total + "%)");
        }
    }
}
