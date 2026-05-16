package com.example.professor_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class ProfessorServiceApplicationTests {

	@Test
	void contextLoads() {
	}

	@Test
	void simpleTest() {
		assertTrue(true);
	}
}
