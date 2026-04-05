# PartyOn

Coding Standards

Naming conventions:
Variables: camelCase: [lower case name] + [(Upper case letter,lower case name),.....]
Constants: Upper case name: [UPPERCASE NAME]
Functions: camelCase: [lower case name] + [(Upper case letter,lower case name),.....]
File names: dot-based (“ .” ) : \\camel-case\\ [fileName] + [ .ts || .[ role  + [ .ts ||                 .[ sub-role…] ] ] 

** The names should be meaningful,relevant and concise,clearly expressing the role\purpose of that structure for which the naming conventions apply.**







File Structure:
src/
      [name1]/
                  [role1]/
                             [sub-role1]/….
                             [sub-role2]
                             [sub-role3]
                             ….
                  [role2]
                  [role3]
                  [role4]
                  ….
       [name2]/……
       [name3]/……
       [name4]/……
       ……








Code Style:
1-One liner functions or statements can be written in a short manner:
Function [name](parameters){short,single statement}
2-Longer functions need always to be written in an organised,clear manner:
Function  [name](parameters){
            Statement1;
            Statement2;
            Statement3;
            ….
}

3-For clarity purposes ,if statements should be always written in the standard form:
If (condition){
           Statement1;
           ……
}
4-Identation can be flexible among different blocks but with the purpose of creating clear,organised and practical visual representations of code blocks and it should be consistent throughout the corresponding code blocks based on the logical development separation of code blocks. : 
       Feature1{
                    …….
                    ……
                    …….
        }
  Feature2{
               …….
               …….
               …….
     }
5-Curly Brackets should start at the structure definition line and end on a new line  : 
[Struture] {
          …..
          …..
          …..
          Ending Statement;
}
6-Spacing within a block can be flexible but consistent within the code block to aid in a more practical and readable code as well as to improve code organisation. It is recommended that there should be at least a space between statement components ,even more when dealing with large and dense code blocks in order to preserve readability and clarity:

Feature1{
        Component1.1  Component1.2  =   Component1.3 (  Component1.4  );
        Component2.1  Component2.2  =   Component2.3 (  Component2.4  );
        Component3.1  Component3.2  =   Component3.3 (  Component3.4  );
        Component4.1  Component4.2  =   Component4.3 (  Component4.4  );
        Component5.1  Component5.2  =   Component5.3 (  Component5.4  );
}

7-It is greatly recommended that comments should be used as code logic separator as well as helping guide to better understand the code block in easier ways and furthermore to make navigation for long files easier and practical for the developers and related or unrelated roles.:
/*         This is feature 1.    (Short Description)         */

Feature1{
/*Here are some Statements and Components     (Short Description if needed)*/

        Component1.1  Component1.2  =   Component1.3 (  Component1.4  );
        Component2.1  Component2.2  =   Component2.3 (  Component2.4  );
        Component3.1  Component3.2  =   Component3.3 (  Component3.4  );
        Component4.1  Component4.2  =   Component4.3 (  Component4.4  );
        Component5.1  Component5.2  =   Component5.3 (  Component5.4  );

                    /* If Statement  or ex: Checking Credentials (clarification if needed)*/
If (condition){
           Statement1;
           ……
}

}
/* End of Feature 1    ……..              */


8-Documentation is emphasised in-file   but clarifications or extra information is recommended when committing changes in the git repositories after performing updates such as adding or deleting files and also adding code or performing modifications to an existing file.
