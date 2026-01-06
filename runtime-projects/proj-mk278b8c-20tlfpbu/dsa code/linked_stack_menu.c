#include<stdio.h>
#include<stdlib.h>
struct Node{
    int info;
    struct Node* link;

};
struct Node* push(struct Node* top){
    struct Node* new;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted");
        scanf("%d",&item);
        new->info=item;
        new->link=NULL;
        if(top==NULL){
            top=new;
        }
        else{
            new->link=top;
            top=new;
        }
    }
    return top;
}
struct Node* pop(struct Node* top){
    struct Node* ptr;
    if(top==NULL){
        printf("UNDERFLOW");
    }
    else{
        ptr=top;
        printf("deleted item is:%d\n",ptr->info);
        top=ptr->link;
        free(ptr);
    }
    return top;
}
void peep(struct Node* top){
    struct Node* ptr;
    if(top==NULL){
        printf("stack is empty");
    }
    else{
        ptr=top;
        printf("list of the stack are:");
        while(ptr!=NULL){
            printf("%d\t",ptr->info);
            ptr=ptr->link;
        }
        printf("\n");
    }
}
int main(){
    struct Node* top=NULL;
    int item,choice;
    do{
        printf("\nPRESS\n1->PUSH\n2->POP\n3->PEEP\nenter your option");
        scanf("%d",&choice);
        switch(choice){
            case 1: top=push(top);
                    peep(top);break;
            case 2: top=pop(top);
                    peep(top);
                    break;
            case 3: peep(top);
                    break;
            case 4: exit(0);
            default: printf("invalid choice");
        }
    }while(choice<5);

}
