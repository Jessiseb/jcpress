package com.jcpress.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminLoginDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(max = 32, message = "用户名过长")
    private String username;

    @NotBlank(message = "口令不能为空")
    @Size(min = 6, max = 64, message = "口令长度需在 6–64 之间")
    private String password;
}
