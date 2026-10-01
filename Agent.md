- 架构风格: 严格执行 Controller -> Service -> DAO 的分层架构。Controller层只做参数校验和编排，Service层负责业务逻辑处理,service层禁止使用mybatis-plus的QueryWarpper，尽量使用mybatis-plus自带的Mapper的方法支持，复杂查询必须使用Mapper自写SQL的方式实现，Entity仅作为数据库映射，禁止包含任何业务逻辑方法
- API Style: 禁用标准 RESTful（避开复杂的 PUT/PATCH），统一使用 GET/POST。
- 依赖注入: 禁使用@Autowired字段注入。必须使用 private final 配合 Lombok 的 @RequiredArgsConstructor 进行构造器注入，确保 Bean 的不可变性和易测试性。禁止用可变 setter 回填依赖来破解装配环：依赖缺失应表现为容器启动失败，不得降级为用户可见文案。
- Lombok: 仅限 `@Data`, `@Getter`, `@Setter`, `@Slf4j`。严禁在 Repository/Entity 中滥用 `@Builder` 导致逻辑缺失
- 好的命名、代码结构是自解释的，注释力求精简准确、表达到位。避免出现注释的一个极端：过多过滥的注释，代码的逻辑一旦修改，修改注释是相当大的负担
- 命名规范: Service/DAO 层方法命名规约
  1） 获取单个对象的方法用 get 做前缀。
  2） 获取多个对象的方法用 list 做前缀。
  3） 获取统计值的方法用 count 做前缀。
  4） 插入的方法用 save/insert 做前缀。
  5） 删除的方法用 remove/delete 做前缀。
  6） 修改的方法用 update 做前缀。
- 命名风格: 类名：必须使用 UpperCamelCase 风格（例外：DO / BO / DTO / VO / AO 等后缀保持大写）。
           方法与变量：方法名、参数名、成员变量、局部变量必须统一使用 lowerCamelCase 风格。
           常量：必须全部大写，单词间用下划线隔开，语义完整（正例：MAX_STOCK_COUNT）。
- 在 if/else/for/while/do 语句中必须使用大括号，即使只有一行代码。
- 异常处理:
          禁止吞没异常：捕获异常后必须处理，禁止捕获后什么都不做（空 catch 块）。若不想处理，必须抛给它的调用者。
          外层处理：最外层的业务使用者必须处理异常，并将其转化为用户可以理解的内容，禁止直接向前端抛出原始堆栈。
- 实现功能的时候不要只实现业务逻辑,还需要考虑是否符合软件工程架构,或者能否使用设计模式对业务逻辑进行优化，以提高代码的可读性、可维护性和可扩展性。
